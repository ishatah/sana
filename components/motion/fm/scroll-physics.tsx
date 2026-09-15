"use client"

import { type ReactNode } from "react"
import { m, useMotionValue, useScroll, useSpring, useTransform, useVelocity } from "motion/react"
import { FmRoot } from "./fm-root"
import { useEntrance } from "./use-entrance"

/**
 * A12, VELOCITY SKEW. The page responds to how fast it is being read.
 *
 * A band leans on the block axis in proportion to scroll velocity and springs back
 * to flat the moment the reader stops. Fast flick: a visible lean. Slow read: a
 * lean too small to name. Stationary: nothing at all.
 *
 * ── WHY THIS IS THE ONE "EXTREME" EFFECT THAT FITS THE BRIEF ──────────────────
 *
 * data/exclusions.json logs intake section 3's ban on `العناصر الحركية الزائدة`
 * against a requested character of `رسمي · قيادي`, and ../hero.ts:348-359 reads
 * that clause as ruling out visible bounce. This does not bounce: `SKEW_SPRING`
 * below is overdamped, so the lean decays to flat without crossing it.
 *
 * More to the point, the effect is INVISIBLE TO A READER WHO IS READING. It only
 * appears under velocity the reader themselves produced, and it is gone before
 * they stop to look at anything. That is the opposite of ornament, it is the
 * page acknowledging an input, which is the category the exclusions clause spares.
 *
 * ── `skewY`, NOT `skewX`, AND THAT IS THE RTL ARGUMENT ────────────────────────
 *
 * ./use-direction.ts lists `skewY` among the properties that are direction-safe by
 * construction, and warns that a helper existing for a flip nobody performs is a
 * trap. Scroll is a block-axis gesture in both locales, Arabic pages do not
 * scroll sideways, so the lean belongs on the block axis and needs no mirror.
 *
 * ── THE CLAMP IS LOAD-BEARING, NOT A SAFETY MARGIN ────────────────────────────
 *
 * Velocity is unbounded. A trackpad flick, a `scrollTo`, or a mobile fling can
 * produce five figures of px/s, and an unclamped mapping turns that into a band
 * sheared past legibility, text at 20° is not text. `useTransform` with a
 * clamped output range pins the extremes, so the worst case is MAX_SKEW and the
 * common case is a fraction of a degree.
 *
 * MAX_SKEW is 2.4°. Measured against the site's type: at 2.4° an 80px hero line
 * displaces about 3.4px corner to corner, which reads as give rather than as
 * distortion. Past about 4° the serif's modulation starts to visibly smear.
 *
 * ── REDUCED MOTION SWITCHES THE INPUT, NOT THE HOOK ORDER ─────────────────────
 *
 * ./use-entrance.ts states the rule: branch OUTPUT RANGES on `reduced`, never hook
 * order. So the velocity subscription is created unconditionally and the output
 * range collapses to [0, 0], the spring still exists and still parks, it simply
 * has nothing to travel to. Toggling the OS setting re-renders and the range
 * changes with no hooks added or removed.
 *
 * ── NO `data-anime` UNDER THIS, AND THE AUDIT ENFORCES IT ─────────────────────
 *
 * This writes `transform` on its own element from a MotionValue. ../dom.ts
 * `setStyles` composes a single `transform` string on the same property, so a
 * shared element would be written by two engines, the failure ./variants.ts
 * describes in full. This wraps a band; the band's CONTENTS keep their
 * `data-anime` hooks and are untouched, because a parent's transform and a
 * child's are separate properties on separate nodes.
 */

/**
 * The velocity at which the lean reaches its maximum, in px/s.
 *
 * 1600px/s is a deliberate flick rather than a read. A comfortable reading scroll
 * on a trackpad sits under 300px/s, which maps to about 0.45°, present in the
 * physics, below the threshold at which a reader would attribute it to the page.
 */
const MAX_VELOCITY = 1600

/** Degrees. See the clamp note above for why this number and not a larger one. */
const MAX_SKEW = 2.4

/**
 * OVERDAMPED ON PURPOSE. ζ = 40 / (2 * sqrt(180 * 0.7)) ≈ 1.13.
 *
 * Past critical, so the lean returns to flat without crossing it. A skew that
 * overshoots reads as a wobble, which is the "excess motion" the intake clause
 * names, and a wobble on a page of serif type reads as a rendering fault rather
 * than as a gesture.
 *
 * `restDelta` is coarser than ../fm/tokens.ts `SCRUB_SPRING` uses (0.0005) because
 * this spring's units are DEGREES, not progress 0..1. At 0.01° the spring parks
 * well below anything a display can resolve, and a spring that never rests is a
 * permanent rAF loop on an idle page.
 */
const SKEW_SPRING = {
  stiffness: 180,
  damping: 40,
  mass: 0.7,
  restDelta: 0.01,
}

export function ScrollPhysics({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <FmRoot>
      <ScrollPhysicsInner className={className}>{children}</ScrollPhysicsInner>
    </FmRoot>
  )
}

function ScrollPhysicsInner({ children, className }: { children: ReactNode; className?: string }) {
  const { reduced } = useEntrance()

  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)

  /*
   * The spring smooths the raw velocity BEFORE it is mapped, not after.
   *
   * Velocity from a wheel event is a step function, a burst per notch with zero
   * between, so mapping it directly produces a lean that flickers on and off at
   * the wheel's tick rate. Springing the velocity first turns those steps into a
   * continuous curve, which is the same argument ./tokens.ts `SCRUB_SPRING` makes
   * for scroll progress.
   */
  const smoothed = useSpring(velocity, SKEW_SPRING)

  const range = reduced ? [0, 0] : [-MAX_SKEW, MAX_SKEW]
  const skewY = useTransform(smoothed, [-MAX_VELOCITY, MAX_VELOCITY], range, { clamp: true })

  return (
    <m.div className={className} style={{ skewY }}>
      {children}
    </m.div>
  )
}

/**
 * A13, SCROLL-VELOCITY TONE. The same input, driving light rather than geometry.
 *
 * A band brightens fractionally as it is scrolled past at speed. It shares
 * `useVelocity` with the skew above but writes `opacity` on a separate overlay
 * element, which is what keeps it inside the one-effect-per-element rule
 * ../sections.ts states: two effects, two properties, two nodes.
 *
 * The ceiling is 0.05 alpha. That is not timidity, a wash over a full band at
 * anything higher reads as a flash, and the gold budget note at the top of
 * styles/globals.css caps ornament well below that in any case.
 */
export function VelocityTone({ className }: { className?: string }) {
  const { reduced } = useEntrance()

  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)
  const smoothed = useSpring(velocity, SKEW_SPRING)

  /*
   * `Math.abs` via a two-sided range rather than a transform function: the wash
   * is symmetric, so scrolling up and scrolling down brighten identically. A
   * one-sided range would light the band only on the way down, which reads as a
   * bug the first time a reader scrolls back.
   */
  const ceiling = reduced ? 0 : 0.05
  const opacity = useTransform(
    smoothed,
    [-MAX_VELOCITY, 0, MAX_VELOCITY],
    [ceiling, 0, ceiling],
    { clamp: true },
  )

  return (
    <FmRoot>
      <m.div aria-hidden className={className} style={{ opacity }} />
    </FmRoot>
  )
}

/**
 * A14, THE PROGRESS RAIL, page-wide.
 *
 * A hairline across the top of the viewport tracking read position. It is the one
 * effect here that is genuinely informational rather than expressive, which is why
 * it survives reduced motion: `scaleX` of a progress bar is not motion the reader
 * did not ask for, it is a readout of where they are.
 *
 * `transform-origin` is mirrored for RTL. A progress rail that fills from the
 * physical left in Arabic fills away from the reading edge, the exact failure
 * ../interactions.ts:90-136 records for the form underline, and the reason
 * ./use-direction.ts exists. Here it is expressed in CSS rather than through that
 * hook, because `transformOrigin` is a static string per direction and the
 * stylesheet can mirror it without a client read.
 */
export function ReadingRail({ className }: { className?: string }) {
  const { scrollYProgress } = useScroll()

  /*
   * NOT sprung. A progress rail that lags its input is a rail that lies about
   * where the reader is, and unlike the skew, the lag here is legible because
   * the rail is a measurement the reader can check against the scrollbar.
   */
  const scaleX = scrollYProgress

  return (
    <FmRoot>
      <m.div aria-hidden className={className} style={{ scaleX }} />
    </FmRoot>
  )
}

/**
 * Kept for the call site that wants the raw value without the wrapper, a
 * MotionValue of 0..1 for the whole document, already shared with the rail above
 * so the two never disagree about where the page is.
 */
export function useDocumentProgress() {
  const { scrollYProgress } = useScroll()
  const idle = useMotionValue(0)
  return typeof window === "undefined" ? idle : scrollYProgress
}
