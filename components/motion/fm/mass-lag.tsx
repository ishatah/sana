"use client"

import { useRef, type ReactNode } from "react"
import { m, useScroll, useSpring, useTransform, useVelocity, useReducedMotion } from "motion/react"
import { FmRoot } from "./fm-root"

/**
 * #44, MASS. One physics, applied at different weights.
 *
 * ── THE PROBLEM WITH PER-SECTION MOTION SETTINGS ──────────────────────────────
 *
 * ./mark-rail.tsx shears the expertise list by up to 1.6° with scroll velocity,
 * and the number is tuned for that list. The moment a second element wants the
 * same behaviour the obvious move is to copy the file and pick a new number, and
 * after four of those the page has four unrelated ideas about how heavy things
 * are. Nothing enforces that a portrait is heavier than a caption; it is just
 * whatever each file's author chose.
 *
 * So there is one constant here and a MASS MULTIPLIER per call site. A heavy
 * element lags more than a light one because it is heavier, not because a
 * different file picked a bigger number. That is what makes the page feel like one
 * physical system rather than a set of tuned effects.
 *
 * ── IT TRANSLATES, IT DOES NOT SHEAR ──────────────────────────────────────────
 *
 * ./mark-rail.tsx shears, and its docblock explains why that is right for a LIST:
 * a shear tilts the horizontal lines of a block of rows, which reads as the whole
 * block being dragged. For a single object, a portrait, a figure, a pull-quote,
 * a shear is wrong: solid objects do not deform when you move them. They LAG.
 *
 * So this translates on the block axis. The direction is the same in both
 * languages because vertical scroll is, which is the same reason ./mark-rail.tsx
 * gives for choosing `skewY` over `skewX`.
 *
 * ── THE CEILING ──────────────────────────────────────────────────────────────
 *
 * 10px at mass 1, at full scroll speed. ../hero.ts:450-457 argues the same case
 * for its 8px portrait drift: at this distance nothing is seen to move, the object
 * merely fails to be perfectly rigid, and that registers as weight. Raising it is
 * the fastest way to turn a physical page into a parallax demo.
 */

/** The lag ceiling in px, at mass 1 and full scroll speed. */
const LAG = 10

/** Scroll speed, px/s, at which the lag reaches its ceiling. Matches ./mark-rail.tsx. */
const LAG_AT = 2400

export function MassLag({
  children,
  className,
  mass = 1,
}: {
  children: ReactNode
  className?: string
  /**
   * How heavy this element is. 1 is the reference, a card, a panel, a figure.
   *
   * Below 1 for something light (a caption, an eyebrow, a rule); above 1 for
   * something that should feel substantial (a portrait, a full-bleed figure).
   *
   * ⚠️ THIS IS THE ONLY KNOB. There is deliberately no per-call-site override of
   * the ceiling or the spring, because that is how one physics becomes four.
   */
  mass?: number
}) {
  const reduced = useReducedMotion()

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <FmRoot>
      <LagBody className={className} mass={mass}>
        {children}
      </LagBody>
    </FmRoot>
  )
}

function LagBody({ children, className, mass }: { children: ReactNode; className?: string; mass: number }) {
  const ref = useRef<HTMLDivElement>(null)

  /*
   * The DOCUMENT's scroll, not this element's progress, the argument
   * ./mark-rail.tsx makes for the same choice: progress is normalised to the
   * target's height, so a short element would produce a large progress-per-second
   * for a slow scroll and lag harder than a tall one at the same speed. `scrollY`
   * is in pixels and means the same thing everywhere.
   */
  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)

  /*
   * ── THE SPRING IS WHERE MASS ACTUALLY LIVES ────────────────────────────────
   *
   * The obvious implementation scales the OUTPUT by mass, a heavier thing moves
   * further. That is wrong, and it is worth being explicit about why: it produces
   * an element that travels further but arrives at the same time, which reads as a
   * bigger effect rather than as a heavier object.
   *
   * Real mass changes the TIME CONSTANT. A heavier object accelerates more slowly
   * and settles more slowly, so `mass` goes into the spring and the output range
   * stays fixed. That is the difference between a physics and a multiplier.
   *
   * Damping is scaled with it to hold the damping ratio roughly constant, so a
   * heavy element settles slowly but still never overshoots, the no-bounce
   * requirement ./tokens.ts documents as a register constraint rather than a
   * taste.
   */
  const smoothed = useSpring(velocity, {
    stiffness: 320,
    damping: 42 * Math.sqrt(mass),
    mass: 0.28 * mass,
    restDelta: 0.5,
  })

  const y = useTransform(smoothed, [-LAG_AT, 0, LAG_AT], [-LAG, 0, LAG], { clamp: true })

  return (
    <m.div ref={ref} data-fm className={className} style={{ y, willChange: "transform" }}>
      {children}
    </m.div>
  )
}
