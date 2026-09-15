"use client"

import { useEffect, useRef } from "react"
import { useMotionValueEvent, useScroll, useSpring, useVelocity, useReducedMotion } from "motion/react"

/**
 * PAGE PHYSICS, one scroll-velocity signal for the whole document.
 *
 * ── THE PROBLEM THIS SOLVES IS DUPLICATION, NOT CAPABILITY ────────────────────
 *
 * ./mark-rail.tsx already derives scroll velocity, springs it, and maps it to a
 * shear. That is correct for one list. But several other effects want the SAME
 * number, type that thickens as the page moves, grain that appears only while
 * scrolling, glyphs that sag under acceleration, elements that lag in proportion
 * to their mass. Built independently that is five `useScroll` calls, five
 * `useVelocity` chains and five springs over one scroll position, which is exactly
 * the speculative registration ../sections.ts:345-351 rules out.
 *
 * So velocity is computed ONCE here and published to <html> as a custom property:
 *
 *   --scroll-speed   0..1, absolute scroll speed against a ceiling
 *   --scroll-dir     -1, 0 or 1, the direction of travel
 *
 * Any surface in styles/globals.css can then react to page motion with no
 * JavaScript at all. That is what makes the film grain, the variable-weight type
 * and the velocity-reactive rules cost a CSS rule each instead of a component each.
 *
 * ── WHY A CUSTOM PROPERTY AND NOT A CONTEXT ───────────────────────────────────
 *
 * A React context carrying a MotionValue would re-render every consumer, or force
 * each one into its own `useTransform` subscription. A custom property on the root
 * is read by the style system directly: no subscribers, no renders, and CSS-only
 * consumers are possible. The cost is one style invalidation per frame WHILE
 * SCROLLING, and zero when still, see the parked-write guard below.
 *
 * ── THE PARKED WRITE IS THE WHOLE PERFORMANCE STORY ───────────────────────────
 *
 * A style write on <html> invalidates the entire document's style. Doing that on
 * every frame forever would be indefensible. Two guards make it cheap:
 *
 *   1. The value is ROUNDED to two decimals and compared against the last write.
 *      A settled spring produces a stream of identical rounded values, so the
 *      writes stop the moment scrolling stops, not merely become cheap, STOP.
 *   2. The spring self-parks (`restDelta`), so it stops scheduling frames at all
 *      once settled. An idle page costs nothing, which is what the plan's leak
 *      test checks.
 *
 * ⚠️ REDUCED MOTION PUBLISHES NOTHING. Every consumer's declared floor in
 * styles/globals.css is the still-page value, so the page simply renders as if it
 * were never scrolled, which is exactly what was asked for.
 */

/** Scroll speed, in px/s, at which `--scroll-speed` reaches 1. Matches ./mark-rail.tsx. */
const SPEED_CEILING = 2400

export function PagePhysics() {
  const reduced = useReducedMotion()
  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)

  /*
   * Low mass, high damping, the same argument ./mark-rail.tsx makes: a page that
   * still looks "in motion" after scrolling has stopped is a page that looks
   * broken. This must decay to nothing almost immediately.
   */
  const smoothed = useSpring(velocity, {
    stiffness: 320,
    damping: 42,
    mass: 0.28,
    /* Without a rest delta the spring never formally settles and keeps scheduling
       frames on an idle page. See the leak note above. */
    restDelta: 0.5,
  })

  /* The last values actually written, so identical frames write nothing. */
  const lastSpeed = useRef(-1)
  const lastDir = useRef(-2)

  useMotionValueEvent(smoothed, "change", (v) => {
    if (reduced) return
    const root = document.documentElement

    const speed = Math.min(Math.abs(v) / SPEED_CEILING, 1)
    const rounded = Math.round(speed * 100) / 100
    if (rounded !== lastSpeed.current) {
      lastSpeed.current = rounded
      root.style.setProperty("--scroll-speed", rounded.toFixed(2))
    }

    /*
     * A DEAD ZONE on the direction, not a plain sign test. Around zero the sprung
     * velocity dithers across the axis, and a raw `Math.sign` would flip the
     * direction several times per second while the page is essentially still,
     * which any direction-dependent effect would render as a visible twitch.
     */
    const dir = speed < 0.02 ? 0 : v > 0 ? 1 : -1
    if (dir !== lastDir.current) {
      lastDir.current = dir
      root.style.setProperty("--scroll-dir", String(dir))
    }
  })

  useEffect(() => {
    const root = document.documentElement
    return () => {
      /* Same cleanup discipline as ./atmosphere.tsx: clear, never write a default,
         so styles/globals.css stays the single source of the floor. */
      root.style.removeProperty("--scroll-speed")
      root.style.removeProperty("--scroll-dir")
    }
  }, [])

  return null
}
