"use client"

import { m, useReducedMotion } from "motion/react"

/**
 * The hero's animated ground: a slow blue gradient wash plus drifting squares.
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
 * ── THE SQUARES ARE THE IBC MARK, NOT DECORATION PICKED AT RANDOM ─────────────
 *
 * The IBC logo is a grid of squares in azure. The drifting squares here are that
 * motif at very low opacity, which is why they are squares rather than the
 * circles or blobs a generic "premium background" reaches for, and why they never
 * rotate: the mark is axis-aligned, and a tilted square reads as a diamond, which
 * is a different shape and not theirs.
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
 *  squares cluster in the outer margins and leave the text column clear. */
const SQUARES = [
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
      {/* The wash. Two large, very low-opacity blue radials that breathe against
          each other. On a white ground this is what stops the page reading as a
          blank sheet, and it is kept under 10% opacity so it never competes with
          the type for attention. */}
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

      {/* The squares. Skipped entirely under reduced motion rather than frozen in
          place: six faint static rectangles are visual noise with no purpose, so
          the honest reduced state is the wash alone. */}
      {!reduced &&
        SQUARES.map((s, i) => (
          <m.span
            key={i}
            className="vvip-square"
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
