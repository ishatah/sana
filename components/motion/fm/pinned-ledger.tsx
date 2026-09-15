"use client"

import { Children, useRef, type ReactNode } from "react"
import { m, useScroll, useSpring, useTransform, useReducedMotion } from "motion/react"
import type { MotionValue } from "motion/react"
import { FmRoot } from "./fm-root"
import { useMediaQuery } from "./use-media"
import { FM_READ_OFFSET } from "./tokens"

/**
 * A5, the working-together section pins, and its rows advance past the pin.
 *
 * ── THIS IS NOT THE CARD DECK THE PLAN DESCRIBED, AND THE MARKUP IS WHY ───────
 *
 * The plan specified a sticky-pinned sequence in which four engagement CARDS
 * stack into a 3D deck, each receding behind the one in front. That design was
 * written against a `<ul>` of four `.card-ruled .panel-3d` buttons in a 2-column
 * grid.
 *
 * That markup no longer exists. The section was rebuilt as a two-column
 * composition, a statement on the left, a HAIRLINE LIST of subjects on the
 * right, and app/[locale]/page.tsx records the reasoning: four bordered boxes
 * were "four repetitions of the same word" with nothing to put in them, so the
 * container was fitted to the content instead of content being invented for the
 * container.
 *
 * Stacking flat list rows into a 3D deck would undo that decision and reintroduce
 * the boxes it deliberately removed. So the EFFECT was kept and its form changed:
 * a pinned depth sequence, expressed as what this section actually is.
 *
 *   THE LEFT COLUMN PINS while the list scrolls past it, so the statement stays
 *   with the subjects it introduces, the same argument app/[locale]/page.tsx
 *   makes for the roles band's `lg:sticky` heading, and the reason that column is
 *   already `md:items-start`.
 *
 *   EACH ROW RESOLVES AS IT REACHES THE READING LINE: it lifts fractionally
 *   toward the reader and settles, one after another, driven by scroll position
 *   rather than by arrival. Scrubbed, so scrolling back un-resolves them.
 *
 * What the reader is shown is unchanged from the plan's intent, these four are
 * one set, read against one statement, not a sequence of separate offers.
 *
 * ── NO OPACITY TERM, DELIBERATELY ─────────────────────────────────────────────
 *
 * The plan flagged this and it still holds: a row faded in by scroll position is
 * a row that is INVISIBLE to anyone whose scroll never reaches it, and invisible
 * to every reader under reduced motion unless a floor catches it. These rows
 * carry the only enquiry affordance in the section. They are opacity 1 at all
 * times; only `z` and `scale` move, and both resolve to the identity at rest.
 *
 * ── STICKY IS SAFE HERE, AND IT IS WORTH SAYING WHY ──────────────────────────
 *
 * `position: sticky` is killed by `overflow: hidden` on ANY ancestor. Checked:
 * neither `.snap-section` nor `.section-content` sets `overflow`, and the section
 * element is `position: relative` with `isolation: isolate`. The `.band-edge` and
 * the band wash are absolutely-positioned siblings, not wrappers.
 *
 * DO NOT ADD `overflow-hidden` TO THIS SECTION. It would silently unpin the
 * column with no error and no visual clue beyond the effect quietly not happening.
 *
 * ── GATED TO THE TWO-COLUMN BREAKPOINT ────────────────────────────────────────
 *
 * The grid collapses to one column below `md`, where the statement sits ABOVE the
 * list and there is nothing to pin it against, a sticky element in a single
 * column would just hold the statement over the rows the reader is trying to
 * read. Below `md` this renders the plain markup and subscribes to nothing, which
 * is the observer discipline ../sections.ts:345-351 states.
 */

/** How far a row lifts toward the reader at the reading line, in px of Z. */
const LIFT = 22

export function PinnedLedger({
  statement,
  children,
  className,
}: {
  statement: ReactNode
  children: ReactNode
  className?: string
}) {
  const reduced = useReducedMotion()
  const wide = useMediaQuery("(min-width: 768px)")
  const ref = useRef<HTMLUListElement>(null)

  const { scrollYProgress } = useScroll({ target: ref, offset: FM_READ_OFFSET })

  /*
   * Softer and heavier than the ledger rail's spring. This drives a lift rather
   * than a progress readout, so a little lag is correct, it is what makes the
   * rows feel like they have weight instead of snapping to attention.
   */
  const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 30, mass: 0.7 })

  const rows = Children.toArray(children)
  const n = rows.length || 1

  const active = !reduced && wide

  /*
   * Both the reduced-motion and the narrow-viewport branch render the ORIGINAL
   * markup: a plain grid, a plain list, no Framer runtime, no sticky. Nothing is
   * hidden and nothing is pinned, which is exactly the section as it was before
   * this component existed.
   */
  if (!active) {
    return (
      <div className={className}>
        {statement}
        <ul ref={ref} className="list-none border-t border-[color:var(--border)]">
          {rows}
        </ul>
      </div>
    )
  }

  return (
    <FmRoot>
      <div className={className}>
        {/*
          The pin. `top` is physical but correct in both directions, RTL mirrors
          the INLINE axis only, and this is the block axis.

          Offset by the nav height plus a little air, so the statement settles
          below the fixed header rather than under it. `--nav-height` is the same
          token components/site-nav.tsx sizes itself from, so the two cannot drift.
        */}
        <div style={{ position: "sticky", top: "calc(var(--nav-height) + 6vh)" }}>
          {statement}
        </div>

        {/*
          `perspective` on the list rather than on each row: one camera for the
          whole set, which is what makes the rows read as lying at different
          depths in one space instead of each having its own vanishing point.
        */}
        <ul
          ref={ref}
          data-fm-pin
          className="list-none border-t border-[color:var(--border)]"
          style={{ perspective: 1400, transformStyle: "preserve-3d" }}
        >
          {rows.map((row, i) => (
            <LedgerRow key={i} progress={progress} index={i} total={n}>
              {row}
            </LedgerRow>
          ))}
        </ul>
      </div>
    </FmRoot>
  )
}

/**
 * One row, lifting as it crosses the reading line and settling behind it.
 *
 * The row's own markup, the <li>, the button, the prefill hooks, is passed
 * through untouched as `children`. This wrapper adds a transform and nothing
 * else, so `prefillEnquiry` in ../interactions.ts still finds
 * `[data-interact="prefill"]` exactly where it expects it.
 */
function LedgerRow({
  children,
  progress,
  index,
  total,
}: {
  children: ReactNode
  progress: MotionValue<number>
  index: number
  total: number
}) {
  /*
   * Each row's moment, as a window on the list's own reading progress.
   *
   * Three stops rather than two: the row rises INTO the reading line and settles
   * back out of it, so the lift is a passing emphasis rather than a state the row
   * stays in. A two-stop ramp would leave every row above the line permanently
   * lifted, which is a stack rather than a sequence.
   */
  const span = 1 / total
  const centre = (index + 0.5) * span
  const window: [number, number, number] = [centre - span, centre, centre + span]

  const z = useTransform(progress, window, [0, LIFT, 0], { clamp: true })
  const scale = useTransform(progress, window, [1, 1.012, 1], { clamp: true })

  return (
    <m.li data-fm style={{ z, scale }}>
      {children}
    </m.li>
  )
}
