"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import { FmRoot } from "./fm-root"
import { DUR, FM_EASE } from "./tokens"

/**
 * A7, the hero role line.
 *
 * ── WHAT THIS REPLACES, AND WHY IT IS A NET DELETION ───────────────────────────
 *
 * `rotateRoles()` in ../hero.ts was ~180 lines: a hand-rolled `scrollWidth`
 * measurement that wrote each role into the live element and put back what was
 * there, a Map cache of those widths, a resize handler to invalidate it, a
 * separately-tracked width spring, and four promise-rejection arms so that
 * tearing down mid-crossfade did not log unhandled rejections.
 *
 * All of it existed to answer one question, how wide is this box about to be,
 * and `layout` projection answers that by measuring the real box after React has
 * rendered the new text. So the measurement code is gone, the cache is gone, the
 * resize handler is gone, and a forced layout per role is gone with them. This is
 * the clearest case in the whole layer where the React bindings are simply the
 * better tool.
 *
 * The VISUAL contract is unchanged on purpose: same 2000ms hold, same first
 * change at HOLD + 600, same out-then-in crossfade, same box reshaping while the
 * text is invisible. A reader should not be able to tell this was rewritten.
 *
 * ── THE CONSTRAINTS INHERITED FROM ../hero.ts:204-234 ──────────────────────────
 *
 * That docblock answers the four reasons the original jQuery.typed typewriter was
 * removed, and none of those answers may be weakened here:
 *
 *   1. NO TYPING, NO PER-CHARACTER ANYTHING. A crossfade changes which of several
 *      true statements is on screen, the way a caption changes. It does not
 *      perform the text. `splitText` is forbidden site-wide and the publish gate
 *      now enforces it.
 *   2. THIS IS NOT THE <h1>. The <h1> is her name and is never touched.
 *   3. THE ELEMENT IS `aria-hidden` and the complete role list renders beside it
 *      in `.sr-only`. Both stay in components/hero.tsx; this component renders
 *      only the animated line.
 *   4. It costs a client boundary, which the hero already has.
 *
 * ── WHY `initial` IS ACCEPTABLE HERE AND NOWHERE ELSE IN THIS LAYER ────────────
 *
 * ./use-entrance.ts exists because Framer serialises `initial` into the SSR style
 * attribute, so `initial={{ opacity: 0 }}` ships HTML that is invisible without
 * JavaScript. That is a real bug this repo has shipped once.
 *
 * `<AnimatePresence initial={false}>` is the documented exemption. It tells Framer
 * that children present on the FIRST render mount at their `animate` state, not
 * their `initial`, so the first role is server-rendered at opacity 1. The
 * `initial` below only ever applies to children mounting after hydration, which by
 * definition requires the bundle to be running.
 *
 * Verify this by disabling JavaScript and reloading: `roles[0]` must be visible.
 * It is on the plan's verification checklist for exactly that reason.
 */

/**
 * Time each role is STILL, in milliseconds.
 *
 * Carried over verbatim from ../hero.ts:251-266, including the reasoning: these
 * are two-word titles, so the read is quick and a long hold reads as a stall. The
 * cycle is HOLD plus the two tween durations, so the visible rhythm is ~2.6s.
 *
 * MILLISECONDS, because it drives a `setTimeout` rather than a Framer option.
 * `DUR.*` below is SECONDS. Both units appear in this file and mixing them is the
 * one hazard here, see ../tokens.ts.
 */
const HOLD = 2000

/** The first change waits a hold plus the entrance, so the role the page loaded
 *  with is the one a visitor actually reads first. Verbatim from ../hero.ts:393-395. */
const FIRST_CHANGE = HOLD + 600

export function RoleCycle({ roles, className }: { roles: string[]; className?: string }) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)

  /*
   * One role is a statement, not a rotation, the same guard as ../hero.ts:241-242.
   * Under reduced motion the interval is never mounted at all: not "shortened to
   * zero", never armed, which is the contract ../hero-scope.tsx:21-33 documents.
   * `useReducedMotion()` subscribes, so toggling the OS setting stops the rotation
   * mid-cycle and leaves whichever role is showing.
   */
  const cycles = roles.length > 1 && !reduced

  useEffect(() => {
    if (!cycles) return

    let timer: ReturnType<typeof setTimeout>

    const step = () => {
      setIndex((i) => (i + 1) % roles.length)
      timer = setTimeout(step, HOLD)
    }

    timer = setTimeout(step, FIRST_CHANGE)
    return () => clearTimeout(timer)
  }, [cycles, roles.length])

  /*
   * Reduced motion renders the plain paragraph with no Framer runtime beneath it
   * at all, no LazyMotion, no presence, no layout projection. The markup is then
   * byte-identical to what the server sent.
   *
   * NOTE THE ABSENCE OF `data-fm` ON THIS BRANCH: there is nothing for the CSS
   * floor to rescue, because nothing was ever written.
   */
  if (!cycles) {
    return (
      <p aria-hidden className={className}>
        {roles[0]}
      </p>
    )
  }

  return (
    <FmRoot>
      {/*
        `layout` on the PARAGRAPH is what reshapes the box.

        The element is `inline-block whitespace-nowrap` (set by the caller, and
        components/hero.tsx:338-357 explains why both are load-bearing): shrink-
        wrapped, so its trailing edge is a real thing that can move. `layout`
        measures that box before and after the text swap and animates between the
        two, which is precisely what the deleted `measure()`/`widthOf()` pair was
        computing by hand.

        THE BOX RESHAPES WHILE THE TEXT IS INVISIBLE, which ../hero.ts:343-350
        calls the whole trick. `mode="wait"` gives that for free: the exiting span
        finishes before the entering one mounts, so the width transition runs
        during the gap when nothing is readable. Reshaping after the swap would
        show new text in a visibly wrong box, which reads as a layout bug.

        `bounce: 0`, no overshoot, ever. ../hero.ts:352-359 argues that a visible
        bounce on a professional profile is exactly the `عناصر حركية زائدة` intake
        section 3 rules out. That was the one spring on the site before this layer
        existed and its parameters are kept.

        NO `data-anime` HERE. The entrance stagger in ../hero.ts targets
        `[data-anime="role-lead"]`, which stays on the WRAPPER in
        components/hero.tsx, the vanilla layer fades the wrapper in on load, this
        layer animates the line inside it. Two effects, two elements, no shared
        property. That is the ownership rule in ./variants.ts.
      */}
      <m.p
        data-fm
        aria-hidden
        layout
        className={className}
        transition={{ layout: { type: "spring", bounce: 0, duration: DUR.d4 } }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.span
            key={roles[index]}
            data-fm
            /*
             * Safe only because of `initial={false}` on the presence above. See
             * the docblock. The out-tween uses EASE.exit, the only accelerating
             * curve in the scale, and the right one for something leaving; the
             * in-tween uses EASE.out and is longer, because arriving should take
             * more time than departing. Both durations are carried over from
             * ../hero.ts:341 and :380.
             */
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: DUR.d3, ease: FM_EASE.out } }}
            exit={{ opacity: 0, y: -8, transition: { duration: DUR.d2, ease: FM_EASE.exit } }}
            style={{ display: "inline-block" }}
          >
            {roles[index]}
          </m.span>
        </AnimatePresence>
      </m.p>
    </FmRoot>
  )
}
