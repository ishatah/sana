"use client"

import { useLayoutEffect, useState } from "react"
import { useReducedMotion } from "motion/react"

/**
 * THE SAFETY PRIMITIVE. Read this before writing any `m.*` element on this site.
 *
 * ── THE BUG THIS EXISTS TO PREVENT ─────────────────────────────────────────────
 *
 * Framer renders the `initial` prop into the SERVER HTML's style attribute. So
 * this:
 *
 *     <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
 *
 * ships as `<div style="opacity:0">`. If the JS chunk 404s, if the bundle throws
 * before hydration, if a corporate proxy strips the script, that element is
 * invisible forever, and there is no deadline to rescue it because the deadline
 * would have lived in the same bundle that failed.
 *
 * components/motion/sections.ts:33-59 states the three-layer model this violates,
 * and the `.reveal` note at the end of styles/globals.css records that this repo
 * has ALREADY SHIPPED this bug once. It is not hypothetical here.
 *
 * ── THE THREE LAYERS, HELD BY THIS HOOK ────────────────────────────────────────
 *
 *   LAYER 1  `initial={false}`, nothing is written to the SSR style attribute at
 *            all. The server ships every element at its finished, readable state,
 *            exactly as it does for the vanilla layer, where `setStyles` writes
 *            the from-state only at the instant an animation is queued to remove
 *            it.
 *
 *   LAYER 2  THE DEADLINE. Once a from-state IS written client-side, a trigger
 *            that never fires would leave it written. So the phase is forced to
 *            "in" after ENTRANCE_DEADLINE regardless of what the observer did,
 *            the same guarantee, and the same 2000ms, as sections.ts:62-70.
 *
 *   LAYER 3  TEARDOWN IS A NO-OP BY CONSTRUCTION. The vanilla layer needs
 *            `clearStyles` because it wrote inline styles to a server-rendered
 *            node. Unmounting an `m.*` element removes the node and its styles
 *            together, so there is nothing to restore and nothing to leak.
 *
 * ── THE HONEST TRADEOFF ────────────────────────────────────────────────────────
 *
 * There is a theoretical single frame where the element paints at "rest" (the
 * finished state) before "from" commits. `useLayoutEffect` runs synchronously
 * after commit and before paint in React 19, so in practice the browser never
 * paints the intermediate, but it is NOT guaranteed the way a direct
 * `el.style.opacity = "0"` is, and on a slow device under main-thread load you
 * may see one frame of finished content before the entrance begins.
 *
 * That trade is deliberate and it is the right way round: one possible frame of
 * CORRECT content, versus a bundle failure that blanks the page permanently.
 * components/motion/hero.ts:96-99 makes the identical argument for the identical
 * reason.
 *
 * ── WHAT DOES NOT NEED THIS HOOK ───────────────────────────────────────────────
 *
 * Scroll-scrubbed animations. A `useTransform` of `scrollYProgress` is a COMPUTED
 * value, it is never serialised into an `initial` prop, and its value at
 * progress 0 is the finished state by design. A1, A2, A4, A5, A6 and A8 are all
 * safe without any of this. Only entrances need a from-state at all.
 */

/**
 * How long an entrance may wait before it is simply completed.
 *
 * Deliberately the same 2000ms as components/motion/sections.ts, and for the
 * reasons given there: long enough that a normal scroll always wins the race, and
 * short enough that nothing is invisible for a length of time a reader would
 * notice or attribute to a broken page.
 */
export const ENTRANCE_DEADLINE = 2000

/** The three states every entrance variant object must declare. */
export type EntrancePhase = "rest" | "from" | "in"

export type EntranceGate = {
  /** Spread onto the `m.*` element. Never override `initial` at the call site. */
  gate: { initial: false; animate: EntrancePhase }
  /** True once a from-state has been written, i.e. the entrance is live. */
  armed: boolean
  /** The visitor has asked for less motion. Branch OUTPUT RANGES on this, never hook order. */
  reduced: boolean
}

/**
 * Wire one Framer entrance so it obeys the site's no-JS contract.
 *
 * Every variant object used with this MUST declare three keys, and `rest` must be
 * identical to `in`, `rest` is the no-JS floor, the reduced-motion resting state
 * AND where the deadline lands, so it has to be the finished, readable state:
 *
 *     const panelVariants = {
 *       rest: { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" },
 *       from: { opacity: 0, clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0 } },
 *       in:   { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" },
 *     }
 *
 * `from` carries `transition: { duration: 0 }` because it is a JUMP, not a move.
 * Animating INTO the hidden state would show the content retreating before it
 * arrives, which is the backwards-entrance failure sections.ts:51-55 describes.
 */
export function useEntrance(): EntranceGate {
  const reduced = useReducedMotion()

  /*
   * Starts at "rest", the FINISHED state, not at "from".
   *
   * This is the whole hook in one line. The first render, which is the one the
   * server produces, has nothing hidden about it.
   */
  const [phase, setPhase] = useState<EntrancePhase>("rest")

  useLayoutEffect(() => {
    /*
     * Under reduced motion the phase never leaves "rest", so no from-state is
     * ever written and there is nothing to tear down. Not "animated with a zero
     * duration", never armed at all, which is the contract
     * components/motion/hero-scope.tsx:21-33 already documents for the vanilla
     * hero. `useReducedMotion()` subscribes to the query, so toggling the OS
     * setting re-runs this and lands the element back on its finished state.
     */
    if (reduced) {
      setPhase("rest")
      return
    }

    setPhase("from")

    // One frame at "from", then release. rAF rather than a timeout: the hidden
    // state must be COMMITTED before the transition to "in" is queued, or Framer
    // interpolates from wherever it currently is and the entrance is skipped.
    const raf = requestAnimationFrame(() => setPhase("in"))

    // LAYER 2. Fires whatever happened above.
    const deadline = setTimeout(() => setPhase("in"), ENTRANCE_DEADLINE)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(deadline)
    }
  }, [reduced])

  return {
    gate: { initial: false, animate: phase },
    armed: phase !== "rest",
    reduced: Boolean(reduced),
  }
}
