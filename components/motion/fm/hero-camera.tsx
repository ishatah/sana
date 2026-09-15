"use client"

import { useRef } from "react"
import { m, useScroll, useSpring, useTransform, useReducedMotion } from "motion/react"
import { FmRoot } from "./fm-root"
import { SCRUB_SPRING } from "./tokens"

/**
 * A1, the hero portrait recedes as the reader leaves.
 *
 * ── WHAT THIS REPLACES ─────────────────────────────────────────────────────────
 *
 * `portraitDrift()` in ../hero.ts scrubbed the figure 8px downward across the
 * hero's exit. That effect is deleted; its 8px survives here as one term of a
 * larger transform, so the portrait's behaviour is strictly a superset of what it
 * was and there is still exactly one effect writing this element.
 *
 * ── THE ARGUMENT THAT LICENSES THIS, INHERITED FROM ../hero.ts:434-463 ─────────
 *
 * A pointer parallax was removed from this exact element, and the objection was
 * not that the figure moved. It is that tying a photograph of a person to the
 * cursor makes her an element of the interface, so every movement reads as the
 * site reacting to the visitor.
 *
 * Scroll carries none of that. It is not a gesture aimed at her; it is the reader
 * leaving, and a frame settling as they go is how a camera behaves rather than
 * how a widget behaves. It also ENDS, once the hero is off screen there is
 * nowhere further to run, whereas the pointer version never settled while the
 * cursor was alive.
 *
 * ── WHY IT IS A CAMERA AND NOT A DRIFT ─────────────────────────────────────────
 *
 * The drift moved one property. This moves five, and they are chosen to describe a
 * single physical event rather than five effects stacked: the portrait pushes back
 * in Z, tilts its top edge away as it passes the camera's axis, trails downward,
 * loses a little scale, and dims at the very end. That is what receding looks
 * like. Animating any one of them alone reads as a widget sliding; animating all
 * five reads as depth.
 *
 * ── THE NUMBERS ARE STILL SMALL, AND THAT IS STILL THE DESIGN ──────────────────
 *
 * ../hero.ts:450-457 argues that every stock hero parallax moves 40-80px, which is
 * what makes the effect legible AS an effect, you see the layers separate and you
 * recognise the template. The same ceiling applies to each term here. 7 degrees of
 * tilt across an entire viewport of scroll is a fraction of a degree per frame;
 * 3.5% of scale is below the threshold at which a reader can name it. Raising any
 * of these is the fastest way to undo the work.
 *
 * ── THE SPRING IS THE CAPABILITY THE VANILLA LAYER LACKS ───────────────────────
 *
 * ../scroll.ts:50-58 records that Motion's vanilla `scroll()` has no smoothing
 * option, anime.js had `sync: 0.25` and nothing replaced it, and mitigates the
 * absence by scrubbing only compositor-only properties so the raw jitter is at
 * least cheap. `useSpring(scrollYProgress)` IS that missing smoothing. The
 * portrait tracks the scroll closely but rounds off the per-frame steps a trackpad
 * produces, which is the difference between a camera move and a jog.
 *
 * ── SAFETY ─────────────────────────────────────────────────────────────────────
 *
 * No `useEntrance` and none needed: every value here is a `useTransform` of scroll
 * progress, which is COMPUTED rather than serialised into an `initial` prop, and
 * its value at progress 0 is the resting state. With the bundle absent the
 * portrait renders exactly as the server sent it.
 *
 * RTL: no `x`, no `rotateY`, no `rotateZ`. `y`, `z`, `rotateX` and `scale` are all
 * direction-invariant, so this is safe by construction, the preference
 * ../interactions.ts:147-152 states.
 */
export function HeroCamera({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  /*
   * The window is the hero's own exit: from where its top meets the viewport top,
   * to where its bottom does. The whole move is spent across exactly the distance
   * the hero is leaving, rather than across the document, the same offset
   * `portraitDrift()` used, and for the reason given at ../hero.ts:477-479.
   *
   * `target` is the wrapper this component renders, which is inside the hero
   * <section>. That is deliberate: it tracks the element that actually moves.
   */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })

  const p = useSpring(scrollYProgress, SCRUB_SPRING)

  /*
   * Hooks run unconditionally; only the OUTPUT RANGES branch on the preference.
   * Collapsing a range to a constant is what makes reduced motion a no-op here
   * rather than a shorter animation, the transform resolves to the identity and
   * the element is never written to in any meaningful way. The `[data-fm]` floor
   * in styles/globals.css is the belt to this braces.
   */
  const z = useTransform(p, [0, 1], reduced ? [0, 0] : [0, -180])
  const rotateX = useTransform(p, [0, 1], reduced ? [0, 0] : [0, 7])
  /* Positive y, the portrait lags DOWNWARD as the page rises, the way a distant
     object trails a near one. Against the scroll it would outrun the text and read
     as the image trying to keep itself on screen (../hero.ts:459-463). The 8 at
     the midpoint is the deleted drift's entire budget, now one term of five. */
  const y = useTransform(p, [0, 0.6, 1], reduced ? [0, 0, 0] : [0, 8, 26])
  const scale = useTransform(p, [0, 1], reduced ? [1, 1] : [1, 0.965])
  /* Dimming starts at 72%, not at 0. A portrait that begins fading the instant the
     reader scrolls reads as the page discarding her; holding full opacity for most
     of the exit and releasing at the end reads as distance. */
  const opacity = useTransform(p, [0, 0.72, 1], reduced ? [1, 1, 1] : [1, 1, 0.55])

  return (
    <FmRoot>
      {/*
        `perspective` must sit on the PARENT of the transformed element, it
        describes the camera, not the subject. Without it `z` and `rotateX` are
        flattened and the whole effect silently degrades to a scale and a nudge.

        Omitted entirely under reduced motion rather than set to `none`: an
        unnecessary perspective on an ancestor establishes a containing block and
        can affect how fixed descendants resolve, so the cleanest reduced state is
        the one where the property was never introduced.
      */}
      <div
        ref={ref}
        style={reduced ? undefined : { perspective: 1200, transformStyle: "preserve-3d" }}
      >
        <m.div data-fm style={{ z, rotateX, y, scale, opacity }}>
          {children}
        </m.div>
      </div>
    </FmRoot>
  )
}
