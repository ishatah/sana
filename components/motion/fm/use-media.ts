"use client"

import { useEffect, useState } from "react"

/**
 * A watched media query.
 *
 * ── WHY THIS EXISTS: OBSERVERS SHOULD MATCH WHAT ACTUALLY PAINTS ───────────────
 *
 * components/motion/sections.ts:345-351 states the rule the vanilla layer follows:
 * every scroll-linked effect is opt-in by markup, "nothing is registered
 * speculatively, so the observer count matches what is actually on the page."
 *
 * A React hook has no equivalent of that check for free. `.ledger-rail` is
 * `hidden lg:block` (components/role-entry.tsx), so on a phone it does not paint
 * at all, but a `useScroll` inside its component still mounts, still subscribes,
 * and still runs a spring, driving an element with `display: none`. This gate is
 * what keeps that promise in the Framer layer.
 *
 * ── WATCHED, NOT SAMPLED ───────────────────────────────────────────────────────
 *
 * A resize across the breakpoint, a rotated phone, or a dragged desktop window all
 * change the answer while the page is open. Sampling once on mount would strand
 * the rail permanently on or off. The listener is the same discipline the four
 * `prefers-reduced-motion` guards in this codebase already use.
 *
 * ── THE PRE-HYDRATION DEFAULT IS `false`, DELIBERATELY ─────────────────────────
 *
 * There is no `matchMedia` on the server, so the first render must guess, and it
 * guesses that the query does NOT match. For the one consumer, the ledger rail,
 * that means the effect is absent on the first paint and mounts a frame later on a
 * wide viewport. That is the correct way round: guessing `true` would mount an
 * effect on a phone and then tear it down, which is the speculative registration
 * the rule above forbids.
 *
 * Content never depends on this. The rail is decoration over a list that is
 * already complete and readable; `.ledger-rail-fill` has its own reduced-motion
 * floor in styles/globals.css.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof matchMedia !== "function") return

    const mq = matchMedia(query)
    const sync = () => setMatches(mq.matches)

    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [query])

  return matches
}

/**
 * True for mouse and trackpad; false for touch and pen.
 *
 * The hook form of `hasFinePointer()` from
 * components/motion/interactions.ts:85-88, which gates `navUnderline` there for
 * the reason given in that file's removal note: an effect that responds to a
 * cursor vector has no meaning for a finger, which arrives already on top of its
 * target.
 *
 * Its one consumer in this layer is A9, the magnetic CTA. Unlike the three
 * pointer effects that file DELETED, A9 decorates a real `<Link>`, but the
 * gating argument is unchanged, and on touch it must cost nothing at all.
 */
export function useFinePointer(): boolean {
  return useMediaQuery("(pointer: fine)")
}
