"use client"

import { useLayoutEffect, useState, type RefObject } from "react"

/**
 * The reading direction at one element, for the Framer layer.
 *
 * ── THIS IS THE REACT EQUIVALENT OF `ruleOrigin()` ─────────────────────────────
 *
 * components/motion/interactions.ts:90-136 documents, at length, a real bug this
 * codebase shipped: `formFields` wrote `transformOrigin: "left"` INLINE, an inline
 * style outranks a stylesheet rule, and it silently defeated the `[dir="rtl"]`
 * mirror sitting right there in styles/globals.css. In Arabic the field underline
 * grew from the physical left and travelled rightward, away from where the text
 * starts, against the reading direction, finishing where the reader began.
 *
 * THE LESSON THERE IS ABOUT INLINE STYLES, NOT ABOUT ARABIC, and it applies with
 * more force here than it did in the vanilla layer: Framer writes EVERYTHING as an
 * inline style. Every logical-property defence the stylesheet has is bypassed by
 * construction. So any Framer animation on the inline axis must resolve its own
 * direction, and this is the one place that resolves it.
 *
 * ── READ FROM THE DOM, NOT FROM A LOCALE PROP ──────────────────────────────────
 *
 * app/layout.tsx sets `dir` on <html> from `isRtl(locale)` before any of this
 * runs, so direction is already in the DOM. Threading a locale down through every
 * wrapper would duplicate that fact and create a second one to keep in sync,
 * the same reasoning stated at interactions.ts:122-125.
 *
 * `closest("[dir]")` rather than reading <html> directly, because a subtree can
 * override direction: components/contact-section.tsx and the contact page both
 * pin `dir="ltr"` around phone numbers and the email grid, and an animation inside
 * one of those must follow its own context rather than the page's.
 *
 * ── WHAT DOES NOT NEED THIS ────────────────────────────────────────────────────
 *
 * Most of the layer, and that is by design rather than by luck. Block-axis motion
 * (`y`, `scaleY`, `skewY`, `rotateX`), block-axis clip-paths, `z`, and anything
 * driven by `layout` projection, which interpolates measured viewport-absolute
 * rects, are all direction-safe by construction. interactions.ts:138-153 makes
 * exactly this argument when it deletes a 1/-1 multiplier that had never flipped
 * anything, and warns that a helper existing for a flip nobody performs is a trap.
 *
 * So: reach for this ONLY for genuine inline-axis physical values. There are
 * three in the whole layer, each commented at its call site:
 *
 *   A2  an SVG line's x1/x2, `pathLength` draws from the path's own start point,
 *       which the stylesheet's `transform-origin` mirror does not affect.
 *   A6  a radial gradient's centre percentage, physical, and the reader enters
 *       the band from the opposite edge in Arabic.
 *   A10 a linear-gradient mask angle, the heading must uncover from the reading
 *       edge, and logical gradient directions lack universal support.
 *
 * Note what is absent: A9's magnetic CTA. Pointer deltas are viewport-physical and
 * a magnet leans toward the PHYSICAL cursor, so flipping it would be precisely the
 * dead-multiplier mistake. That call site carries its own note saying so.
 */

export type Direction = "ltr" | "rtl"

/**
 * Resolve direction at `ref`, defaulting to `"ltr"` until the DOM is readable.
 *
 * ── WHY "ltr" IS THE PRE-HYDRATION DEFAULT AND WHY THAT IS SAFE ────────────────
 *
 * There is no `document` during server rendering, so the first render must guess.
 * It guesses `"ltr"`, but nothing is animated on that render: every consumer of
 * this hook is either scroll-scrubbed (value at progress 0 IS the finished state)
 * or gated behind `useEntrance`, which holds at "rest" until its own layout
 * effect. By the time any direction-dependent value is READ, this effect has run.
 *
 * `useLayoutEffect` rather than `useEffect` so the correction lands before paint.
 */
export function useDirection(ref: RefObject<HTMLElement | SVGElement | null>): Direction {
  const [dir, setDir] = useState<Direction>("ltr")

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const scope = el.closest("[dir]")
    const resolved = scope?.getAttribute("dir") ?? document.documentElement.dir
    setDir(resolved === "rtl" ? "rtl" : "ltr")
  }, [ref])

  return dir
}
