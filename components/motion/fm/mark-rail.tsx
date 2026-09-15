"use client"

import { Children, useRef, type ReactNode } from "react"
import { m, useScroll, useSpring, useVelocity, useTransform, useReducedMotion, type MotionValue } from "motion/react"
import { ExpertiseCard } from "./expertise-card"
import { FmRoot } from "./fm-root"

/**
 * A2 + A4, the expertise wall.
 *
 * ── TWO EFFECTS, ONE WRAPPER, ONE SCROLL SUBSCRIPTION ──────────────────────────
 *
 * A2 draws the margin marks in sequence as the list is read. A4 shears the whole
 * list fractionally with scroll velocity. They live in one component because they
 * are driven by the same scroll and splitting them would mean two `useScroll`
 * calls, two subscriptions and two sets of bookkeeping over the same element,
 * the speculative registration ../sections.ts:345-351 rules out.
 *
 * ════════════════════════════════════════════════════════════════════════════
 *  A2, THE MARKS DRAW AS YOU READ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Each gold gutter stroke scales from nothing to its full length as its row
 * enters the reading zone, and UN-DRAWS on the way back up. That last part is why
 * it is scrubbed rather than triggered: a mark that draws once and stays is an
 * entrance, and the entrance layer already owns arrivals. Tied to scroll position
 * the rail of marks becomes a reading indicator for the list, how far down the
 * inventory you are, which is information rather than decoration.
 *
 * ── THE GUTTER MARKS ARE GONE ────────────────────────────────────────────────
 *
 * Each row used to carry a short gold stroke in its gutter, scrubbed from
 * `scaleX(0)` to full length as the row entered the reading zone. The strokes were
 * decoration standing in for a bullet, so they have been removed along with the
 * per-row progress window that drew them. What remains here is the list's shear
 * and the card treatment, which are about the panel rather than an ornament.
 *
 * ⚠️ DO NOT SET `transformOrigin` FROM THIS FILE. An inline value would outrank
 * the stylesheet's RTL mirror and silently break Arabic. That is the whole lesson
 * of the `formFields` bug.
 *
 * ════════════════════════════════════════════════════════════════════════════
 *  A4, THE LIST HAS MASS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The whole list shears very slightly in the direction of scroll travel and
 * springs back to flat the instant scrolling stops. At speed it reads as the list
 * being dragged past; at rest it is perfectly flat and typographically correct.
 *
 * ── 1.6 DEGREES IS THE CEILING AND IT IS THE WHOLE DESIGN ────────────────────
 *
 * Every stock velocity-skew runs 8-15°, which is what makes them legible AS an
 * effect, you see the page lean and you recognise the technique. At 1.6° nothing
 * visibly leans; the list simply fails to be perfectly rigid, which registers as
 * weight. This is the same argument ../hero.ts:450-457 makes for the 8px portrait
 * drift, and raising it is the single fastest way to undo the work.
 *
 * ── `skewY`, NEVER `skewX` ────────────────────────────────────────────────────
 *
 * `skewY` shears on the BLOCK axis, it tilts horizontal lines. The input is
 * vertical scroll, which is identical in both languages, so a shear that leans one
 * way in English should lean the same way in Arabic. It needs no mirror and gets
 * none.
 *
 * `skewX` would need a direction multiplier AND would slant the glyphs against
 * their own baseline, which on Arabic script is a legibility problem rather than a
 * stylistic one.
 */

/** The shear ceiling, in degrees. See the docblock before changing it. */
const SHEAR = 1.6

/** Scroll speed, in pixels per second, at which the shear reaches its ceiling. */
const SHEAR_AT = 2400

/**
 * #25, the rolling-shutter travel, in px, across the WHOLE wall.
 *
 * Six pixels from the first row to the last. At four columns that is six pixels
 * spread over two rows, so no row moves more than about three pixels relative to
 * its neighbour. The same ceiling argument as SHEAR above: nobody sees this as
 * motion, they see the wall as having a shutter.
 */
const SHUTTER = 6

export function MarkRail({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLUListElement>(null)

  /*
   * A4's driver: the DOCUMENT's scroll, not the list's progress.
   *
   * Velocity has to come from absolute scroll position because the list's own
   * progress is normalised to its height, a short list would produce a large
   * progress-per-second for a slow scroll and shear harder than a long one at the
   * same speed. `scrollY` is in pixels and means the same thing everywhere.
   */
  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)
  /*
   * Low mass, high damping: the shear must vanish almost immediately when
   * scrolling stops. A shear that lingers is a page that looks bent.
   *
   * The spring also self-parks, it stops scheduling frames once it settles
   * within its rest delta, so an idle page costs nothing. That is what the plan's
   * leak test checks for.
   */
  const smoothed = useSpring(velocity, { stiffness: 320, damping: 42, mass: 0.28 })
  const skewY = useTransform(
    smoothed,
    [-SHEAR_AT, 0, SHEAR_AT],
    reduced ? [0, 0, 0] : [-SHEAR, 0, SHEAR],
    { clamp: true },
  )

  const rows = Children.toArray(children)

  /*
   * Reduced motion renders the plain list: no Framer runtime, no subscriptions
   * and no springs.
   *
   * THE CARD IS STILL RENDERED, and that is not an oversight. `.glass-card` is a
   * SURFACE TREATMENT, frost, a metallic edge, a centred sheen, and none of it
   * is motion. A reduced-motion visitor asked for less movement, not for a
   * different, plainer page; dropping the card here would give them unstyled
   * phrases on a bare background while everyone else sees a designed grid.
   *
   * `ExpertiseCard` checks the same preference internally and renders itself
   * inert: no perspective, both tilt ranges collapsed to zero, and the pointer
   * handler returns before it writes anything. So this branch gets the card's
   * appearance and none of its behaviour.
   */
  if (reduced) {
    return (
      <ul ref={ref} className={className}>
        {rows.map((row, i) => (
          <li key={i} className="expertise-row" data-anime="panel">
            <ExpertiseCard>
              {row}
            </ExpertiseCard>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <FmRoot>
      <m.ul
        ref={ref}
        data-fm
        className={className}
        style={{
          skewY,
          /* The one element in this component that transforms continuously, so
             the one that earns a promoted layer. Not applied under reduced
             motion, where the list never transforms at all. */
          willChange: "transform",
        }}
      >
        {rows.map((row, i) => (
          <MarkRow key={i} index={i} total={rows.length} smoothed={smoothed}>
            {row}
          </MarkRow>
        ))}
      </m.ul>
    </FmRoot>
  )
}

/**
 * One row of the wall.
 *
 * The row's content is passed through untouched, which keeps the server component
 * rendering the phrase, that is localized content, while this client component
 * owns only the card treatment around it.
 *
 * It took `progress`, `index` and `total` when it drew a per-row gutter mark
 * scrubbed to reading position. That mark is gone, so the scroll progress it
 * needed is gone with it rather than being threaded through unused.
 */
function MarkRow({
  children,
  index,
  total,
  smoothed,
}: {
  children: ReactNode
  index: number
  total: number
  smoothed: MotionValue<number>
}) {
  /*
   * ── #25, ROLLING SHUTTER ────────────────────────────────────────────────────
   *
   * The wall's shear (A4, above) tilts every row by the same amount at the same
   * instant, which is a rigid sheet being leaned. A real rolling shutter exposes
   * the top of the frame before the bottom, so during fast motion the top has
   * already moved while the bottom has not, the deformation is DISTRIBUTED down
   * the frame rather than applied uniformly.
   *
   * That is a strictly better model for this wall and it costs one transform per
   * row, because the velocity spring it reads is the one A4 already computes. No
   * second `useScroll`, no second subscription, no second spring, the thing
   * ../sections.ts:345-351 rules out.
   *
   * ── THE LAG IS PER-ROW AND TINY ─────────────────────────────────────────────
   *
   * Each row lags in proportion to its position down the list, to a maximum of
   * SHUTTER px at the last row. Combined with the wall's 1.6° shear the result is
   * a wall that does not merely lean but WINDS slightly as it leans, which is
   * what film does and what a CSS transform does not.
   *
   * 6px across the whole wall. At four columns that is 6px across two rows, so no
   * single row moves more than about 3px relative to its neighbour. Nobody will
   * see this as motion; they will see the wall as having a shutter.
   */
  const depth = total > 1 ? index / (total - 1) : 0
  const y = useTransform(smoothed, [-SHEAR_AT, 0, SHEAR_AT], [-SHUTTER * depth, 0, SHUTTER * depth], {
    clamp: true,
  })

  return (
    /*
      `py-6` is gone from this element: the card owns its own padding now, and a
      row that also padded itself would double the gap between cards into
      something no grid gap value could correct.
    */
    <li className="expertise-row" data-anime="panel">
      {/*
        THE CARD IS A THIRD ELEMENT, NOT A CLASS ON THIS <li>.

        This row carries `data-anime="panel"` and ../sections.ts writes its
        opacity, and tears down with `clearStyles`, which wipes the whole inline
        style surface rather than the properties it wrote. A transform written
        here by the Framer layer would be erased by that cleanup. See the
        ownership note in ./expertise-card.tsx.

        ⚠️ AND THAT IS WHY THE SHUTTER OFFSET IS PASSED DOWN RATHER THAN APPLIED
        HERE. #25 wants a per-row translate, and this <li> is the one element in
        the row the Framer layer may not write to: `clearStyles` in
        ../sections.ts would wipe it mid-flight. The card below already owns a
        transform, so it composes the shutter into the one it is writing.
      */}
      <ExpertiseCard shutterY={y}>{children}</ExpertiseCard>
    </li>
  )
}
