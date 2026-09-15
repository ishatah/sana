"use client"

import { LazyMotion, domMax } from "motion/react"

/**
 * The Framer feature bundle, loaded once.
 *
 * ── IMPORT FROM `motion/react`, NEVER FROM `framer-motion` ─────────────────────
 *
 * They are the same code: node_modules/motion/dist/react.d.ts is literally
 * `export * from 'framer-motion'`, and framer-motion@13.3.0 is already installed
 * as a transitive dependency of the `motion` package this site already depends on.
 * So no dependency was added for any of this, and package.json did not change.
 *
 * Adding `framer-motion` as a SECOND direct dependency would be actively harmful
 * rather than merely redundant: it creates a second version range npm can resolve
 * to a different minor than the one `motion` pulls, putting two copies of the
 * projection singleton in the bundle, at which point `layoutId` and `LayoutGroup`
 * silently stop matching across the boundary. Silently. The roles ordinal in A3
 * would simply stop travelling, with no error.
 *
 * scripts/check-publish-gate.mjs enforces this.
 *
 * ── WHY `domMax` AND NOT `domAnimation` ────────────────────────────────────────
 *
 * `domAnimation` (~15kB gz) carries animations, gestures and exit. `domMax`
 * (~25kB gz) adds PROJECTION, the layout engine, and projection is what
 * `layoutId` and `layout` are built on. There is no half measure: `layoutId`
 * without `domMax` does nothing at all, and does it quietly.
 *
 * Three animations need it: A3 (the roles ordinal morph, `layoutId`), A5 (the
 * card stack, `layout`) and A7 (the hero role line's width transition, `layout`).
 * If the bundle budget is ever revisited, A3 is the one to cut, everything else
 * fits inside `domAnimation`, and the plan says so.
 *
 * ── `strict` IS THE ENFORCEMENT FOR `m.*`, AND IT IS THE WHOLE POINT ───────────
 *
 * LazyMotion only pays for itself if every call site uses `m.*`. A single
 * `motion.div` anywhere statically imports the full feature bundle and defeats the
 * code split entirely, which is exactly how a lazy setup silently stops being
 * lazy. `strict` throws in development the moment anyone writes `motion.*` inside
 * this tree, so the regression is caught at the first render rather than in a
 * bundle report nobody reads. The publish gate catches it in CI too.
 *
 * ── WHY THIS IS NOT IN THE ROOT LAYOUT ─────────────────────────────────────────
 *
 * app/[locale]/layout.tsx:68-78 records that a client provider was deliberately
 * REMOVED from the top of every page, and putting one back there would re-add the
 * exact boundary that note objects to, every route paying for the Framer runtime
 * whether or not it animates anything.
 *
 * Instead each of the (few) new client wrappers renders this itself. Nested
 * `LazyMotion` with identical features is a no-op, so several on one page cost
 * nothing, and a route with no Framer animation loads none of it.
 */
export function FmRoot({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      {children}
    </LazyMotion>
  )
}
