"use client"

import { m, useReducedMotion } from "motion/react"
import { VvipAtmosphere } from "@/components/motion/fm/vvip-atmosphere"

/**
 * The hero's animated ground: the atmosphere field and the drifting IBC dots,
 * in that paint order.
 *
 * The atmosphere is a WebGL canvas and lives in its own file, components/motion/
 * fm/vvip-atmosphere.tsx, which carries the reasoning for it. It is mounted HERE
 * rather than beside VvipField in components/hero-vvip.tsx because this component
 * is already a client leaf: mounting inside it adds the canvas to an existing
 * client subtree instead of opening the hero's fourth one.
 *
 * ── THE WASH IS GONE, AND SO IS THE WAVE ─────────────────────────────────────
 *
 * This used to paint a CSS radial wash, then a travelling sine band, then the
 * dots. The wash and the band are both folded into the shader now. The reason
 * was not that either was individually bad: it was that the wash, the band and
 * the dots were ALL soft, all the same blue, all between 0.06 and 0.30 alpha,
 * so three layers meant to read as depth composited into one haze. The shader
 * replaces them with a soft mesh under a CRISP contour grid, which is the
 * contrast this ground never had. See that file's docblock.
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
   * the exact stimulus that triggers symptoms. When it is set, the dots are not
   * rendered at all, rather than frozen or slowed, and the stylesheet hides the
   * canvas — so the reduced state is the plain white hero. It also subscribes,
   * so toggling the OS setting takes effect without a reload.
   */
  const reduced = useReducedMotion()

  return (
    <div aria-hidden className="vvip-field">
      {/* The atmosphere, FIRST: the ground everything else sits on.

          Below the dots because those are the IBC mark, and a mark dimmed by
          decoration is a brand error. That reason was true when a wave occupied
          this slot and is unchanged by what replaced it.

          VvipAtmosphere owns its own reduced-motion and no-WebGL handling. */}
      <VvipAtmosphere />

      {/* The dots. Skipped entirely under reduced motion rather than frozen in
          place: six faint static circles are visual noise with no purpose, so the
          honest reduced state is the bare hero. */}
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
