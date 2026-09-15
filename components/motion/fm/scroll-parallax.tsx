"use client"

import { useRef, type ReactNode } from "react"
import { m, useScroll, useSpring, useTransform, useReducedMotion } from "motion/react"
import { FmRoot } from "./fm-root"
import { SCRUB_SPRING } from "./tokens"

/**
 * A12, depth on a band that is leaving.
 *
 * The inner-page equivalent of ./hero-camera.tsx, which applies the same recession
 * to the home hero's portrait. A band recedes slightly and releases as it exits
 * through the top of the viewport, so the page reads as layered rather than as one
 * flat sheet sliding past.
 *
 * ── FULLY REVERSIBLE, BECAUSE IT HOLDS NO STATE ───────────────────────────────
 *
 * Every value is a `useTransform` of scroll position. There is no "played" flag
 * and no observer that latches. Scroll back up and the band comes forward again,
 * exactly retracing its path, because its appearance is a pure function of where
 * the reader is. That is the property this whole layer was added for.
 *
 * ── WHY THIS IS SAFE WITHOUT `useEntrance` ────────────────────────────────────
 *
 * ./use-entrance.ts:95-101 states the rule and this is a textbook case: a computed
 * scroll transform is never serialised into the SSR `initial` prop, and its value
 * at progress 0 is the resting state. A failed bundle leaves the band exactly as
 * the server rendered it. The `[data-fm]` floor in styles/globals.css and the
 * `.no-js [data-fm]` rule beneath it are the second and third defences.
 *
 * ── THE WINDOW IS THE EXIT ONLY ───────────────────────────────────────────────
 *
 * `["start start", "end start"]`, from the band's top edge meeting the viewport
 * top, to its bottom edge doing the same. Nothing happens while the band is
 * arriving or while it is being read; the whole move is spent on the way out.
 *
 * That matters for legibility rather than taste. A band that animated on ARRIVAL
 * would be moving while the reader is trying to start reading it. This one is
 * static for the entire time it occupies the viewport and only recedes once the
 * reader has demonstrably moved past it.
 *
 * RTL: `y`, `z`, `rotateX`, `scale` and `opacity` are all direction-invariant.
 * Safe by construction, no `useDirection` needed, which is the preference
 * ../interactions.ts:138-153 states and warns against violating with a
 * multiplier that never flips anything.
 */
export function ScrollParallax({
  children,
  className,
  /**
   * How far the band recedes, 0–1, as a fraction of the full effect.
   *
   * The home hero uses the full budget because it is a masthead the reader is
   * meant to leave behind. A content band carries less, it is furniture, not a
   * statement, so the call sites pass a fraction and the ranges scale together
   * rather than each being retuned by hand.
   */
  depth = 1,
}: {
  children: ReactNode
  className?: string
  depth?: number
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const p = useSpring(scrollYProgress, SCRUB_SPRING)

  /*
   * Hooks run unconditionally; only the OUTPUT RANGES branch on the preference.
   * Collapsing a range to a constant makes reduced motion a true no-op, the
   * transform resolves to the identity rather than to a shorter animation. This
   * is the discipline ./hero-camera.tsx and ./band-tone.tsx already follow, and
   * branching hook ORDER instead would be a rules-of-hooks violation that only
   * appears when the visitor toggles the OS setting with the page open.
   */
  const off = reduced ? 0 : depth

  const z = useTransform(p, [0, 1], [0, -120 * off])
  const rotateX = useTransform(p, [0, 1], [0, 5 * off])
  /* Positive y, the band lags DOWNWARD as the page rises, the way a distant
     object trails a near one. Against the scroll it would outrun the text and read
     as the band trying to hold itself on screen (../hero.ts:459-463). */
  const y = useTransform(p, [0, 0.6, 1], [0, 6 * off, 20 * off])
  const scale = useTransform(p, [0, 1], [1, 1 - 0.03 * off])
  /* Releasing starts at 74%, not at 0. A band that begins fading the instant the
     reader scrolls reads as the page discarding it; holding full opacity for most
     of the exit and releasing at the end reads as distance. */
  const opacity = useTransform(p, [0, 0.74, 1], [1, 1, 1 - 0.45 * off])

  return (
    <FmRoot>
      {/*
        `perspective` belongs on the PARENT of the transformed element, it
        describes the camera, not the subject. Without it `z` and `rotateX` are
        flattened and the effect silently degrades to a scale and a nudge.

        Omitted entirely under reduced motion rather than set to `none`: an
        unnecessary perspective establishes a containing block and changes how
        fixed descendants resolve, so the cleanest reduced state is the one where
        the property was never introduced at all.
      */}
      <div
        ref={ref}
        className={className}
        style={reduced ? undefined : { perspective: 1200, transformStyle: "preserve-3d" }}
      >
        <m.div data-fm style={{ z, rotateX, y, scale, opacity }}>
          {children}
        </m.div>
      </div>
    </FmRoot>
  )
}
