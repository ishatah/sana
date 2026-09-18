"use client"

import { Children, useRef, type ReactNode } from "react"
import { useReducedMotion } from "motion/react"
import { ExpertiseCard } from "./expertise-card"
import { FmRoot } from "./fm-root"

/**
 * The expertise wall's list scaffolding.
 *
 * ── THERE IS NO LONGER ANY SCROLL-DRIVEN MOTION HERE ──────────────────────────
 *
 * This component used to own two effects, both driven by SCROLL VELOCITY, and
 * both have been removed on the site owner's instruction of 2026-09-19: the
 * band shook while scrolling.
 *
 *   A4, THE SHEAR. The whole <ul> was given `skewY`, mapped from a spring over
 *   `useVelocity(scrollY)` to a ceiling of 1.6 degrees, springing back to flat
 *   when scrolling stopped.
 *
 *   #25, THE ROLLING SHUTTER. Each row was translated on Y in proportion to its
 *   index, to 6px at the last row, from the SAME velocity spring, so the wall
 *   wound slightly as it leaned.
 *
 * The argument for both was that their amplitudes were far below the threshold
 * at which a velocity effect reads AS an effect — 1.6 degrees where the stock
 * version of the technique runs 8-15 — so the wall would register as having
 * weight rather than as leaning. That reasoning is sound in the abstract and it
 * is not what happens on this page.
 *
 * WHY SMALL AMPLITUDE DID NOT MAKE IT SUBTLE. A velocity signal is differentiated
 * scroll position, so it is noisy by construction: a trackpad or a smooth-scroll
 * wheel delivers position in uneven steps, and the derivative of an uneven ramp
 * is a jitter. Spring-smoothing shapes that jitter but cannot remove it, because
 * the spring is chasing a target that is itself rattling. The result is not a
 * lean, it is a tremble, and a tremble is MORE visible at small amplitude than a
 * large one: a big skew reads as a deliberate swoop, a tiny one reads as the
 * text failing to sit still. Every row of this wall is body copy, and type that
 * will not hold still while being read is the worst place to spend this effect.
 *
 * It also compounded. `.depth-stage` and `.grid-breath` on the same element were
 * both scroll-linked once too, and both were made static earlier for the same
 * complaint — see their notes in styles/globals.css, one of which records this
 * as "the band that shook first on weaker GPUs". Those two fixes removed the
 * per-frame reflow and re-raster; this one removes the last moving part.
 *
 * ── WHAT IS DELIBERATELY KEPT ────────────────────────────────────────────────
 *
 * The card's POINTER tilt in ./expertise-card.tsx is untouched. It is driven by
 * pointer position, not scroll, so it only moves when the reader is deliberately
 * pointing at a card and it never moves while reading. That is a different
 * effect with a different input, and none of the above applies to it.
 *
 * The `.glass-card` surface treatment, the entrance animation via
 * `data-anime="panel"`, and every atmosphere class on the <ul> are likewise
 * untouched: none of them is scroll-velocity driven.
 *
 * ── WHY THIS COMPONENT STILL EXISTS ──────────────────────────────────────────
 *
 * With both effects gone it renders a plain <ul> of cards and no longer needs
 * Framer's scroll machinery or a velocity spring. It is kept rather than folded
 * into components/expertise-grid.tsx because that is a SERVER component and
 * `ExpertiseCard` is a client one: something has to own the boundary, and this
 * is it. The phrases still render on the server and cross as children, exactly
 * as before.
 *
 * ⚠️ `FmRoot` STAYS, AND REMOVING IT SILENTLY BREAKS THE CARD TILT.
 *
 * It is tempting to drop it along with the scroll effects, since nothing in
 * THIS file animates any more. That was tried and it is wrong: `FmRoot` is the
 * `LazyMotion` provider, and ./expertise-card.tsx renders an `<m.div>` whose
 * pointer tilt needs that runtime loaded. Without a provider above it the
 * element still renders and still takes its classes, so the page looks correct
 * and nothing errors — the tilt just never moves.
 *
 * MEASURED both ways: with the provider, pointing at opposite corners of a card
 * yields two different `matrix3d(...)` transforms; without it, both corners read
 * `none`. That is the whole failure, and it is invisible unless you test the
 * hover specifically.
 *
 * Both branches below now render the same tree. That is intentional and not a
 * redundancy to collapse: `ExpertiseCard` reads `prefers-reduced-motion` itself
 * and renders inert, so the reduced branch differs in the card's behaviour
 * rather than in this file's markup. Keeping the explicit branch documents that
 * the equality is a current fact about this list, not a guarantee.
 */
export function MarkRail({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLUListElement>(null)

  const rows = Children.toArray(children)

  /*
   * `reduced` is read but no longer changes the markup, because there is no
   * motion left here to suppress. It is kept so that the reduced-motion contract
   * of this component stays explicit at the top level rather than living only
   * inside the card.
   */
  void reduced

  return (
    <FmRoot>
      <ul ref={ref} className={className}>
      {rows.map((row, i) => (
        /*
         * `data-anime="panel"` stays: that is the ENTRANCE layer in
         * ../sections.ts, which fades each panel in once as it arrives. An
         * entrance is not scroll-velocity motion and is not what was removed.
         *
         * The <li> carries no transform of its own. It never could — the note
         * that used to sit here explained that ../sections.ts writes this
         * element's style and tears it down with `clearStyles`, which wipes the
         * whole inline style surface. That is why the shutter offset was passed
         * down to the card rather than applied here. With the shutter gone there
         * is nothing to pass, and the card takes no motion prop at all.
         */
          <li key={i} className="expertise-row" data-anime="panel">
            <ExpertiseCard>{row}</ExpertiseCard>
          </li>
        ))}
      </ul>
    </FmRoot>
  )
}
