"use client"

import { useScroll, useSpring, useTransform, useReducedMotion, type MotionValue } from "motion/react"
import { SCRUB_SPRING } from "./tokens"
import type { RefObject } from "react"

/**
 * BIDIRECTIONAL REVEAL, the primitive behind every reversible entrance.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  THIS IS A DIFFERENT CONTRACT FROM ./use-entrance.ts. READ BOTH BEFORE PICKING.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * `useEntrance` fires ONCE and settles. The element arrives, and from then on the
 * page is still. That is the contract ../sections.ts and ../hero.ts hold, and it
 * is still the right one for the hero, where the reader has not scrolled yet and
 * an entrance is genuinely an arrival.
 *
 * THIS hook ties the same reveal to scroll POSITION, so it plays forward as the
 * reader descends and plays backward as they return. Nothing is "already done";
 * the page's state is a pure function of where the reader is in it. That is what
 * makes it reversible, and reversibility is the whole reason it exists.
 *
 * ── WHY A SCRUB NEEDS NO `useEntrance` SAFETY GATE ─────────────────────────────
 *
 * ./use-entrance.ts:95-101 already states this and it is worth restating at the
 * one place that relies on it: a `useTransform` of `scrollYProgress` is a COMPUTED
 * value. It is never serialised into an `initial` prop, so it never reaches the
 * server-rendered style attribute, so a bundle that fails to load cannot leave
 * anything hidden. The no-JS floor is the static markup itself.
 *
 * That is only true because of how the ranges below are shaped, see next.
 *
 * ── THE RESOLVED PLATEAU IS THE SAFETY PROPERTY, NOT A STYLE CHOICE ────────────
 *
 * The naive shape for a reversible reveal is a straight ramp: progress 0 hidden,
 * progress 1 revealed. It is wrong, and wrong in a way that hurts reading rather
 * than merely looking bad.
 *
 * Under a straight ramp an element is only fully opaque at exactly one scroll
 * position. Stop anywhere else, which is everywhere a reader actually stops,
 * and the text you are reading is at 70% opacity, mid-blur, slightly offset. The
 * reader cannot fix it by stopping, because stopping is what holds it there.
 *
 * So every range here is a PLATEAU: hidden at the bottom of the window, fully
 * resolved across the whole middle, and (for the exit, when enabled) released
 * only at the very top. `ENTER_END` means an element is completely readable well
 * before it reaches the middle of the viewport, and stays that way for the rest
 * of its window. The motion happens in the margins of the reading experience,
 * never in the middle of it.
 *
 * ── AND WHY THE EXIT IS OPT-IN, DEFAULTING TO OFF ─────────────────────────────
 *
 * A symmetric reveal, fading back out as the element leaves the top, is the
 * more obviously "reversible" design, and it is the wrong default for a page
 * whose content is prose. Text that dims as you read toward the top of the
 * viewport is text fighting the reader.
 *
 * `exit: true` is for elements where leaving is part of the composition and the
 * content is not being read at that moment: figures, rules, decorative marks. The
 * call sites that pass it each say why.
 */

/**
 * Progress at which an element is fully resolved, arriving from below.
 *
 * ── WHY 0.62 AND NOT SOMETHING SMALLER ────────────────────────────────────────
 *
 * This is a balance between two failures that pull in opposite directions, and
 * both were measured rather than reasoned about.
 *
 * TOO LOW and the reveal never reads. With the window ending at `"end 80%"` (see
 * the offset note), an element that is already on screen when the page loads is
 * most of the way through its window before the reader touches the wheel. At 0.42
 * the contact form sampled 0.99 at scroll-top and 1.0 everywhere after, the
 * animation was technically running and visually absent.
 *
 * TOO HIGH and content is caught mid-fade while it is being read, which is the
 * failure the plateau exists to prevent in the first place.
 *
 * 0.62 leaves a real span of motion while still resolving comfortably before the
 * element reaches the middle of the viewport, where reading actually happens.
 */
const ENTER_END = 0.62

/** Progress at which a departing element begins to release, when `exit` is on. */
const EXIT_START = 0.78

export type ScrubRevealOptions = {
  /**
   * Also release the element as it leaves through the top.
   *
   * OFF by default. See the note above: this must not be switched on for prose.
   */
  exit?: boolean
  /**
   * Where the reveal window opens and closes, as `useScroll` offsets.
   *
   * ⚠️ THE DEFAULT ENDS AT `"end 80%"`, NOT `"end start"`, AND THAT IS A BUG FIX.
   *
   * The obvious window for a crossing is `["start end", "end start"]`, from the
   * element's top edge entering the bottom of the viewport to its bottom edge
   * leaving the top. It is what ./hero-camera.tsx and ./band-tone.tsx use, and it
   * is wrong for a REVEAL, because it assumes the element will eventually travel
   * off the top of the screen.
   *
   * THE LAST ELEMENT ON A PAGE NEVER DOES. The footer cannot scroll past the
   * viewport top, the document ends. So its progress stops partway, the plateau
   * at ENTER_END is never reached, and it sits permanently semi-transparent.
   *
   * Measured, not theorised: with `"end start"` the footer parked at opacity 0.30
   * with the page scrolled fully to the bottom, on every route. It is exactly the
   * "short target pinned at one end of its range" failure ./tokens.ts documents
   * for FM_READ_OFFSET, reached by a different route.
   *
   * `"end 80%"` closes the window when the element's bottom edge reaches 80% of
   * the viewport height, a position ANY element can reach, including one flush
   * against the end of the document. Combined with the ENTER_END plateau it means
   * a reveal is fully resolved once the element is properly on screen, which is
   * the behaviour the reader actually needs.
   */
  offset?: [string, string]
}

export type ScrubReveal = {
  /** 0 → 1 → (1 → 0 with `exit`). Spring-smoothed. Drive output ranges off this. */
  progress: MotionValue<number>
  /** The visitor asked for less motion. Branch OUTPUT RANGES on this, never hook order. */
  reduced: boolean
}

/**
 * Scroll-linked reveal progress for one element.
 *
 * Returns a single 0→1 value that is spring-smoothed and safe to feed into any
 * number of `useTransform` output ranges at the call site. One `useScroll` per
 * revealed element, and one spring, the cost the call sites are written around.
 *
 * ── REDUCED MOTION COLLAPSES THE RANGE, IT DOES NOT SKIP THE HOOKS ────────────
 *
 * `reduced` is returned rather than acted on, because branching hook ORDER on a
 * media query is a rules-of-hooks violation that only manifests when the visitor
 * toggles the OS setting with the page open, `useReducedMotion` subscribes, so
 * that re-render really happens. Every call site in this layer branches its output
 * RANGE instead, which is the discipline ./hero-camera.tsx and ./band-tone.tsx
 * already follow. This hook keeps running the same hooks in the same order and
 * simply pins its output at 1, fully resolved, forever.
 */
export function useScrubReveal(
  ref: RefObject<HTMLElement | null>,
  { exit = false, offset }: ScrubRevealOptions = {},
): ScrubReveal {
  const reduced = useReducedMotion()

  /*
   * `exit` keeps the FULL crossing, because a release on the way out is
   * meaningless without one, the element has to actually leave for there to be
   * an exit to animate. That is safe precisely where `exit` is safe to use at
   * all: the note on the option restricts it to figures, rules and decoration,
   * none of which is ever the last element on a page.
   *
   * Resolved in the body rather than as a default parameter, since a default
   * cannot read a sibling binding out of the same destructuring pattern.
   */
  const window_: [string, string] =
    offset ?? (exit ? ["start end", "end start"] : ["start end", "end 80%"])

  /*
   * `offset` is cast because the React `useScroll` types it as a mutable array of
   * a union of ~60 template-literal types, which a `[string, string]` parameter
   * does not satisfy. ./tokens.ts documents the same collision for
   * FM_READ_OFFSET and solves it there with an explicit literal tuple
   * annotation, that works for a module constant but not for a caller-supplied
   * prop, which must stay assignable from a plain pair.
   */
  const { scrollYProgress } = useScroll({ target: ref, offset: window_ as never })

  /*
   * Smoothed before it is shaped, not after.
   *
   * The spring has to sit on the RAW progress so that every output range derived
   * below shares one inertia. Springing each derived value separately would give
   * the opacity and the translate slightly different arrival times on the same
   * element, which reads as the element coming apart.
   */
  const smoothed = useSpring(scrollYProgress, SCRUB_SPRING)

  /*
   * The plateau. Under reduced motion every stop maps to 1, so the element is
   * resolved at every scroll position and no output range below can move it.
   */
  const progress = useTransform(
    smoothed,
    exit ? [0, ENTER_END, EXIT_START, 1] : [0, ENTER_END, 1],
    reduced ? (exit ? [1, 1, 1, 1] : [1, 1, 1]) : exit ? [0, 1, 1, 0] : [0, 1, 1],
    { clamp: true },
  )

  return { progress, reduced: Boolean(reduced) }
}
