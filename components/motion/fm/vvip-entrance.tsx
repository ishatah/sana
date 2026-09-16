"use client"

import { m } from "motion/react"
import type { ReactNode } from "react"
import { useEntrance } from "@/components/motion/fm/use-entrance"

/**
 * The hero's staggered entrance: a slow fade and a short rise, one element after
 * another.
 *
 * ── WHY THIS IMPORTS `motion/react` AND NOT `framer-motion` ───────────────────
 *
 * It was written against `framer-motion` first, because that is what was asked
 * for. `npm run check:copy` rejected it, and the gate is right:
 * scripts/check-publish-gate.mjs:141 bans that specifier because the two packages
 * are the same code (`motion/dist/react.d.ts` re-exports `framer-motion`) and a
 * second DIRECT dependency can resolve to a different minor, putting two copies
 * of the projection singleton in one bundle. That breaks `layoutId` and `layout`
 * animations SILENTLY — no error, the affected element simply stops travelling.
 *
 * `m.*` rather than `motion.*` for the sibling reason (gate rule at :146): a
 * single `motion.*` statically pulls in the full Framer feature bundle and
 * defeats the code split that `FmRoot`'s `LazyMotion` exists to create.
 *
 * ── AND WHY IT USES `useEntrance()` RATHER THAN `initial`/`animate` ───────────
 *
 * THIS IS THE IMPORTANT PART, AND IT IS NOT A STYLE PREFERENCE.
 *
 * The obvious spelling of a fade-up is `initial={{opacity:0, y:20}}` with
 * `animate={{opacity:1, y:0}}`. Framer serialises `initial` into the SERVER-
 * RENDERED style attribute, so that spelling ships literal
 * `<div style="opacity:0;transform:translateY(20px)">` in the HTML. If the JS
 * chunk 404s, throws before hydration, or is stripped by a proxy, the content is
 * invisible FOREVER: the code that would have revealed it lived in the bundle
 * that failed. This hero's name, title and both calls to action were all inside
 * such a wrapper when it was first written, and measuring the served HTML is how
 * that was caught. See use-entrance.ts:11-22 — this repo has shipped that bug
 * before.
 *
 * `useEntrance()` inverts it: the first render is the FINISHED state, so the
 * server ships visible content; the client then jumps to the hidden state and
 * releases it one frame later, and a 2000ms deadline fires the release
 * unconditionally in case anything upstream stalls. Under reduced motion the
 * phase never leaves "rest" and no hidden state is ever written.
 *
 * ── THE STAGGER IS PARENT-DRIVEN ──────────────────────────────────────────────
 *
 * `VvipStagger` declares the stagger and each `VvipRise` inherits its timing
 * through variant propagation, so the order is DOM order and no child carries a
 * hand-tuned delay. Hand-tuned delays are how a stagger drifts out of sequence
 * the first time someone reorders two lines.
 */

/** The house --ease-out, cubic-bezier(0.4, 0, 0.16, 1), as Framer needs it.
 *  The CSS custom property cannot be read from JS, so the curve is written out;
 *  if the token changes, change this with it. They are meant to be one curve. */
const EASE_OUT = [0.4, 0, 0.16, 1] as const

/*
 * The three-key variant contract `useEntrance` drives, per use-entrance.ts:94-102.
 *
 *   rest  the finished state, and the one the SERVER renders
 *   from  the hidden state, jumped to instantly (duration 0, it is a jump not a
 *         move — animating INTO hidden shows content retreating before it arrives)
 *   in    the finished state again, reached on the real curve
 *
 * `rest` and `in` are deliberately identical values; only the transition differs.
 */
const STAGGER_VARIANTS = {
  rest: {},
  from: {},
  in: {
    transition: {
      staggerChildren: 0.13,
      // A beat before the first child, so the entrance reads as deliberate
      // rather than as the page finishing loading.
      delayChildren: 0.18,
    },
  },
}

const RISE_VARIANTS = {
  rest: { opacity: 1, y: 0 },
  from: { opacity: 0, y: 20, transition: { duration: 0 } },
  in: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE_OUT } },
}

const PORTRAIT_VARIANTS = {
  rest: { opacity: 1, y: 0, scale: 1 },
  from: { opacity: 0, y: 24, scale: 0.985, transition: { duration: 0 } },
  in: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 1.25, ease: EASE_OUT, delay: 0.25 },
  },
}

export function VvipStagger({ children, className }: { children: ReactNode; className?: string }) {
  const { gate } = useEntrance()

  return (
    /* `data-fm` marks this as Framer-owned, which the runtime audit in
       components/motion/fm/audit.tsx uses to enforce the one-transform-writer
       rule. An animated element without it is invisible to that check. */
    <m.div className={className} data-fm variants={STAGGER_VARIANTS} {...gate}>
      {children}
    </m.div>
  )
}

export function VvipRise({ children, className }: { children: ReactNode; className?: string }) {
  /*
   * NO `gate` OF ITS OWN, AND NO `initial`.
   *
   * The parent's `animate` propagates down the variant tree, so a child that
   * declares matching variant KEYS follows the parent's phase automatically and
   * inherits the stagger. Giving each child its own useEntrance() would arm N
   * independent clocks and the stagger would collapse into everything at once.
   */
  return (
    <m.div className={className} data-fm variants={RISE_VARIANTS}>
      {children}
    </m.div>
  )
}

/**
 * The portrait's entrance: the same rise, longer and with a trace of scale, so
 * the image settles a beat after the text beside it.
 *
 * It runs its OWN gate rather than joining the text stagger, because it lives in
 * the second column. Folding it into that sequence would make the portrait wait
 * for every line above it, which at these durations is most of two seconds of
 * empty frame next to finished text.
 */
export function VvipPortraitReveal({ children, className }: { children: ReactNode; className?: string }) {
  const { gate } = useEntrance()

  return (
    <m.div className={className} data-fm variants={PORTRAIT_VARIANTS} {...gate}>
      {children}
    </m.div>
  )
}
