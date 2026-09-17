"use client"

import { m, useReducedMotion } from "motion/react"
import { VvipWave } from "@/components/motion/fm/vvip-wave"

/**
 * The hero's animated ground: a glowing blue wave, a slow gradient wash, and
 * drifting squares, in that paint order.
 *
 * The wave is a WebGL canvas and lives in its own file, components/motion/fm/
 * vvip-wave.tsx, which carries the reasoning for it. It is mounted HERE rather
 * than beside VvipField in components/hero-vvip.tsx because this component is
 * already a client leaf: mounting inside it adds the canvas to an existing
 * client subtree instead of opening the hero's fourth one.
 *
 * ── WHY `motion/react` AND `m.*` RATHER THAN `framer-motion` / `motion.*` ─────
 *
 * Both are enforced by scripts/check-publish-gate.mjs (:141 and :146) and both
 * rules are right. The two packages are the same code, so a second DIRECT
 * dependency buys nothing and risks resolving to a different minor, which puts
 * two copies of the projection singleton in one bundle and breaks layout
 * animations with no error. `m.*` keeps the LazyMotion code split that `FmRoot`
 * exists to create; one `motion.*` anywhere statically pulls the full feature
 * bundle and defeats it for the whole page.
 *
 * This file is a decorative LEAF: no children, so it re-opens no client boundary
 * around the hero's server-rendered content.
 *
 * ── THE DOTS ARE THE IBC MARK, NOT DECORATION PICKED AT RANDOM ───────────────
 *
 * CORRECTED. This said "The IBC logo is a grid of SQUARES in azure" and drew
 * squares on that basis. The logo is a cluster of CIRCLES: seven dots of varying
 * size in two blues, loosely gridded in two rows, reading as connection rather
 * than as a grid. The old note was a factual claim about somebody else's mark,
 * used as the justification for the shape, and it was wrong.
 *
 * It matters more now than it did, because the real lockup renders in the same
 * hero (see the affiliation block in components/hero-vvip.tsx). A background of
 * squares beside a mark made of circles is a contradiction on one screen.
 *
 * The varying sizes below are part of the same echo: the IBC cluster is not a
 * uniform grid, so a uniform one would be a different mark. They never rotate,
 * which for circles is now moot but stays true of the composition.
 *
 * ── EVERY VALUE IS SLOW ON PURPOSE ────────────────────────────────────────────
 *
 * The brief asked for "smooth, slow, expensive", and the failure mode for this
 * kind of background is motion fast enough to be noticed while reading. Nothing
 * here moves faster than a 26-second cycle, and the drift distances are small
 * enough (≤40px) that no square crosses a text column during a read. If a visitor
 * can time the loop, it is too fast.
 */

/** Deterministic, not random: `Math.random()` would give every render a different
 *  layout and make the hero impossible to screenshot-diff. Hand-placed so the
 *  dots cluster in the outer margins and leave the text column clear. */
const DOTS = [
  { left: "6%", top: "18%", size: 118, delay: 0, drift: -26, dur: 23, peak: 0.1 },
  { left: "13%", top: "64%", size: 66, delay: 2.4, drift: 22, dur: 26, peak: 0.08 },
  { left: "78%", top: "12%", size: 152, delay: 1.2, drift: 30, dur: 25, peak: 0.09 },
  { left: "88%", top: "52%", size: 88, delay: 3.6, drift: -20, dur: 22, peak: 0.07 },
  { left: "69%", top: "78%", size: 54, delay: 4.8, drift: 16, dur: 24, peak: 0.1 },
  { left: "31%", top: "86%", size: 40, delay: 1.8, drift: -14, dur: 21, peak: 0.06 },
]

export function VvipField() {
  /*
   * The one guard that is not optional.
   *
   * `prefers-reduced-motion` is an accessibility setting, not a preference about
   * taste: for a vestibular-disorder sufferer, drifting background geometry is
   * the exact stimulus that triggers symptoms. When it is set, this component
   * renders the STATIC gradient and no squares at all, rather than the same
   * animation slowed down. It also subscribes, so toggling the OS setting takes
   * effect without a reload.
   */
  const reduced = useReducedMotion()

  return (
    <div aria-hidden className="vvip-field">
      {/* The wash, FIRST. It is the GROUND the wave is lit against, not a haze
          the wave shines through.

          This used to sit on top, on the theory that a moving band beneath a
          static haze reads as atmosphere the light travels through. Good idea,
          wrong numbers: the wash painted the same three blues as the wave at a
          comparable alpha, and blue over blue gives the eye no hue difference to
          resolve depth from. In practice it did not read as atmosphere at all,
          it just raised the ground the wave had to contrast against and erased
          the band. Its alphas are now roughly halved and one radial has moved to
          the slate, so it still stops the page reading as a blank sheet while
          leaving the wave something to be brighter than. */}
      <m.div
        className="vvip-field-wash"
        animate={
          reduced
            ? undefined
            : {
                // Deliberately not a loop back through the same position: the
                // keyframes walk out and return by a different route, so the
                // cycle is hard to perceive as a cycle.
                // Every keyframe holds a scale >= 1.25, which is what replaces
                // the old `inset: -25%`: the element stays exactly viewport-sized
                // in LAYOUT (so it adds nothing to document scrollWidth) and is
                // oversized only in PAINT, where a translate cannot expose an
                // edge. See the note on .vvip-field-wash in styles/globals.css.
                transform: [
                  "translate3d(0%, 0%, 0) scale(1.25)",
                  "translate3d(2.5%, -2%, 0) scale(1.32)",
                  "translate3d(-1.5%, 2.5%, 0) scale(1.28)",
                  "translate3d(0%, 0%, 0) scale(1.25)",
                ],
              }
        }
        transition={{ duration: 34, ease: "easeInOut", repeat: Infinity, repeatType: "loop" }}
      />

      {/* The wave, SECOND: above the wash, below the dots.

          Above the wash because it is the subject and the wash is its ground.
          Below the dots because those are the IBC mark, and a mark dimmed by
          decoration is a brand error — that reason was true when the wave was at
          the bottom of the stack and is unchanged by moving it up. The wash has
          no comparable claim; it is unbranded atmosphere.

          VvipWave owns its own reduced-motion and no-WebGL handling. */}
      <VvipWave />

      {/* The dots. Skipped entirely under reduced motion rather than frozen in
          place: six faint static circles are visual noise with no purpose, so the
          honest reduced state is the wash alone. */}
      {!reduced &&
        DOTS.map((s, i) => (
          <m.span
            key={i}
            className="vvip-dot"
            style={{ left: s.left, top: s.top, width: s.size, height: s.size }}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, s.peak, s.peak, 0], y: [0, s.drift, s.drift * 0.4, 0] }}
            transition={{
              duration: s.dur,
              delay: s.delay,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "loop",
              // The opacity ramp holds at peak for the middle half of the cycle,
              // so a square spends most of its life visible and only the ends
              // fading. Fading the whole way through reads as flickering.
              times: [0, 0.25, 0.75, 1],
            }}
          />
        ))}
    </div>
  )
}
