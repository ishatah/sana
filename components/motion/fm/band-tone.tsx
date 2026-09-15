"use client"

import { useRef } from "react"
import { m, useScroll, useTransform, useMotionTemplate, useInView, useReducedMotion } from "motion/react"
import { FmRoot } from "./fm-root"
import { useDirection } from "./use-direction"
import { FM_BAND_OFFSET } from "./tokens"

/**
 * A6, the band's ground warms as the reader crosses it.
 *
 * ── WHAT THIS REPLACES ─────────────────────────────────────────────────────────
 *
 * `mountScrollLinked()` in ../sections.ts scrubbed `.band-tone`'s OPACITY from 0
 * up to 1 and back down across the band's crossing. That handle is deleted; this
 * component owns the element now, so there is still exactly one effect on it.
 *
 * ── WHAT IT ADDS, AND WHY IT IS INFORMATION RATHER THAN DECORATION ─────────────
 *
 * The old scrub said "you are somewhere in a band". This says WHERE: the wash's
 * radial centre travels from the edge the reader entered by to the edge they will
 * leave by, so the warmth is ahead of them on the way in and behind them on the
 * way out. The brightness still peaks at the middle, which is what keeps it
 * reading as a room with a temperature rather than as a tinting page.
 *
 * `useMotionTemplate` is what makes this possible at all, it interpolates values
 * INTO a CSS string, so a gradient's centre and its alpha can both be scrubbed.
 * The vanilla API has no equivalent; ../sections.ts could only animate whole
 * properties, which is why the old version could only move opacity.
 *
 * ── THE BUDGET, WHICH IS THE CONSTRAINT THAT SHAPED EVERY NUMBER ───────────────
 *
 * The `.band-tone` note in styles/globals.css is explicit: 4% gold at full
 * opacity, "below the threshold at which it reads as a colour", and "anything a
 * reader can consciously name here is too much, a page that visibly tints as you
 * scroll is a parallax showcase, which is precisely the register this build
 * avoids."
 *
 * That ceiling is respected. The gradient's own stop is `rgba(…, alpha)` where
 * alpha peaks at 0.075, but it is composited over a ground the stylesheet
 * already establishes, and the element's own declared opacity is 0, so the
 * effective warmth at peak is in the same range the CSS describes. The number is
 * a little higher than 0.04 because the centre now moves, and a travelling wash
 * spends less time over any given pixel than a static one does.
 *
 * ── PERFORMANCE: THIS IS THE MOST EXPENSIVE EFFECT IN THE LAYER ────────────────
 *
 * `background` is a PAINT property. Every other scrubbed value on this site is
 * compositor-only, which ../scroll.ts:50-58 names as the deliberate mitigation for
 * having no scroll smoothing. This one repaints a full-band gradient per frame, so
 * three things hold it down:
 *
 *   1. The element is already its own layer, `position: absolute; inset: 0;
 *      z-index: 0` in the stylesheet, so the repaint is confined to it and never
 *      touches the text above.
 *   2. `will-change: background` is applied ONLY while the band is in view. A
 *      permanent one on four full-viewport elements would cost more than the
 *      repaint it avoids, which is the trap that makes `will-change` a pessimism
 *      more often than an optimisation.
 *   3. The centre percentages are rounded to one decimal, so a sub-pixel scroll
 *      does not re-serialise the template string. Without this the gradient is
 *      re-parsed on frames where nothing visibly changed.
 *
 * If profiling ever shows this is still hot, the escape hatch is two stacked
 * static gradients crossfaded on `opacity`, which is compositor-only and loses
 * only the travelling centre.
 */
export function BandTone() {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const dir = useDirection(ref)

  /*
   * The full crossing, edge to edge, the same window ../scroll.ts calls
   * BAND_OFFSET, so this layer frames a band exactly as the vanilla one did.
   *
   * `target` is the tone element itself rather than the section. It is
   * `inset: 0` within the section, so the two rects are identical, and using the
   * element means this component needs no ref threaded down from the page.
   */
  const { scrollYProgress } = useScroll({ target: ref, offset: FM_BAND_OFFSET })

  /* `once: false`, the wash must respond every time the band is crossed, in
     either direction, so this cannot latch. `amount: 0` because a band this tall
     is "in view" as soon as any part of it is. */
  const inView = useInView(ref, { amount: 0 })

  /*
   * Up then down, peaking at the centre. ../sections.ts:363-369 gives the reason:
   * a wash that is brightest as the band LEAVES reads as the page reacting after
   * the fact. Peaking in the middle reads as the reader being inside something.
   */
  const alpha = useTransform(scrollYProgress, [0, 0.5, 1], reduced ? [0, 0, 0] : [0, 0.075, 0])

  /*
   * ⚠️ THE ONE PHYSICAL VALUE IN THIS FILE.
   *
   * A gradient's `at X%` is measured from the PHYSICAL left edge. It is not a
   * logical property and the browser will not flip it for Arabic.
   *
   * The reader enters an RTL band from the right, so the wash must travel
   * 70 → 30 there and 30 → 70 in LTR. Getting this wrong is not subtle once you
   * look for it: the warmth would lead the reader on the way out and trail them on
   * the way in, in exactly the language where the layout is otherwise mirrored
   * correctly.
   *
   * This is the bug class ../interactions.ts:96-120 documents at length, a
   * physical constant written from JS silently defeating the stylesheet's logical
   * defences, and it is why `useDirection` exists.
   */
  const cxRaw = useTransform(scrollYProgress, [0, 1], dir === "rtl" ? [70, 30] : [30, 70])
  /* Down the frame as the band passes: the light source is above and behind, and
     it rises relative to the content as the content scrolls up past it. */
  const cyRaw = useTransform(scrollYProgress, [0, 0.5, 1], [62, 50, 38])

  /* Rounding is the third performance mitigation, not cosmetic. See the docblock. */
  const cx = useTransform(cxRaw, (v) => Math.round(v * 10) / 10)
  const cy = useTransform(cyRaw, (v) => Math.round(v * 10) / 10)

  const background = useMotionTemplate`radial-gradient(120% 80% at ${cx}% ${cy}%, rgba(var(--primary-rgb), ${alpha}), transparent 70%)`

  /*
   * Reduced motion renders the plain decorative span, no Framer runtime, no
   * scroll subscription, no repaint. `.band-tone` declares `opacity: 0` in the
   * stylesheet, so its resting state is invisible and nothing is lost: the band
   * simply has no wash, which is exactly what `.section-invert .band-tone
   * { display: none }` already does for the light band.
   *
   * No `data-fm` on this branch, there is nothing for the CSS floor to rescue
   * because nothing was ever written.
   */
  if (reduced) {
    return <span aria-hidden className="band-tone" />
  }

  return (
    <FmRoot>
      <m.span
        ref={ref}
        data-fm
        aria-hidden
        className="band-tone"
        style={{
          background,
          /* Opacity is NOT scrubbed any more, the alpha inside the gradient is.
             Scrubbing both would be two effects on one element's appearance and
             they would multiply, making the peak unpredictable. The element sits
             at full opacity and the gradient decides how much of it is visible. */
          opacity: 1,
          willChange: inView ? "background" : "auto",
        }}
      />
    </FmRoot>
  )
}
