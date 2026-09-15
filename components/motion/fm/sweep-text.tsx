"use client"

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react"
import { m, animate, useMotionTemplate, useMotionValue, useReducedMotion } from "motion/react"
import { FmRoot } from "./fm-root"
import { useDirection } from "./use-direction"
import { DUR, FM_EASE, ms } from "./tokens"

/**
 * A band of light sweeps a line of text into view, from the reader's starting
 * edge. The text does not move, does not fade, and is never rebuilt: one CSS
 * property animates on an element whose children are passed straight through.
 *
 * ── THIS IS ./mask-heading.tsx, GENERALISED, AND THE SPLIT IS THE POINT ───────
 *
 * `MaskHeading` hard-codes an `<h2>` and triggers on `useInView`, because it
 * exists for `SectionHeader` and a section heading is uncovered when the reader
 * reaches it. Neither of those holds for the hero: the element there is a `<p>`
 * and it is ALREADY ON SCREEN at load, so an in-view trigger would fire it at an
 * arbitrary moment during the hero's own entrance rather than at its place in
 * that sequence.
 *
 * So this takes the tag and the delay as props and fires on MOUNT. Everything
 * else, the four defences below, the two-property motion template, the teardown
 * that drops the mask entirely, is `MaskHeading`'s design, and deliberately not
 * a second take on it. If a bug is found in one, check the other.
 *
 * ⚠️ THE SAME HAZARD, UNDIMINISHED. `mask-image` degrades to INVISIBLE TEXT, not
 * to unanimated text. Every other effect on this site fails to "nothing
 * happened"; this one fails to "the sentence is gone". All four defences are
 * required and none may be dropped as redundant:
 *
 *   1. NO MASK IN THE SSR HTML. The mask is written only by the effect below,
 *      client-side, after mount. The server ships plain readable text, so a
 *      bundle that 404s or throws leaves the sentence exactly as it was. This is
 *      the ./use-entrance.ts contract, hence no `initial` prop anywhere here.
 *   2. THE MASK IS REMOVED WHEN THE SWEEP ENDS, not parked at its end stop. A
 *      permanent mask-image is a permanent compositing cost and a standing
 *      hazard: any later style recalculation that reinterprets the gradient
 *      risks clipping text somebody is reading.
 *   3. `useReducedMotion()` returns the bare element with no Framer runtime under
 *      it, byte-identical to the server's output, no observer, no mask.
 *   4. THE CSS FLOORS. `[data-fm]` resets both `mask-image` and
 *      `-webkit-mask-image` under `prefers-reduced-motion` AND under `.no-js`
 *      (styles/globals.css). `data-fm` is set below so this element is covered by
 *      both; removing that attribute silently removes two of the four defences.
 *
 * ── NO TEXT IS SPLIT, AND THAT IS NOT NEGOTIABLE ──────────────────────────────
 *
 * `splitText` is forbidden site-wide and scripts/check-publish-gate.mjs fails the
 * build on the identifier. The rule exists because organisation names and the
 * subject's own name must render as single intact text nodes (intake section 6,
 * data/exclusions.json, ../sections.ts:136-140).
 *
 * That rule is what this component is FOR. The obvious way to animate a sentence
 * is to split it into words or characters and stagger them; the obvious way is
 * banned here, and a mask sweep is the sanctioned alternative, it reads as the
 * line arriving without the markup ever knowing where the words are. `children`
 * is passed through untouched and is never inspected, split, wrapped or measured.
 *
 * ⚠️ NEVER APPLY THIS TO THE HERO <h1>. That element renders a real person's name
 * and ../../hero.tsx is explicit that it carries no animation hook at all.
 */
export function SweepText({
  as = "p",
  children,
  className,
  delay = 0,
  ...rest
}: {
  /** The tag to render. Anything but a heading that carries the subject's name. */
  as?: ElementType
  children: ReactNode
  className?: string
  /** Position in the hero's choreography, in MILLISECONDS. Converted at the
   *  boundary by `ms()`, see ./tokens.ts for why a raw number is a hazard. */
  delay?: number
} & Record<string, unknown>) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const dir = useDirection(ref)

  /*
   * ⚠️ THIS FLAG IS DEFENCE 1, AND IT IS NOT A CONVENIENCE.
   *
   * `style={{ maskImage: mask }}` cannot simply be declared. `mask` is a
   * `useMotionTemplate`, and Framer RESOLVES motion values in `style` on the
   * first render, including the server one. With `stop` at 0 that resolves to
   *
   *     linear-gradient(90deg, #000 0%, transparent calc(0% + 16%))
   *
   * which is a mask that hides the entire line. It would be written into the SSR
   * style attribute, and a bundle that never arrives would leave the sentence
   * INVISIBLE FOREVER, precisely the ./use-entrance.ts bug, in the one property
   * whose failure mode is unreadable text.
   *
   * So `style` is `undefined` until this flag flips, which happens in an effect
   * and therefore never on the server. The mask exists only once there is a
   * running animation to remove it. ./mask-heading.tsx gets the same guarantee
   * from `inView`, which is false during SSR for the same reason.
   */
  const [armed, setArmed] = useState(false)

  /*
   * ⚠️ A PHYSICAL ANGLE, AND THE ONE VALUE HERE THAT NEEDS DIRECTION.
   *
   * The line must uncover from the edge the reader starts at: left in English,
   * right in Arabic. A gradient angle is physical and the browser will not flip
   * it for RTL the way it flips a margin.
   *
   * `to inline-end` would say this logically, but support is not universal enough
   * to stake invisible-text on. An explicit angle is the conservative choice.
   */
  const angle = dir === "rtl" ? "270deg" : "90deg"

  /*
   * ONE MOTION VALUE, TWO DERIVED PROPERTIES, AND THE REASON IS TYPES.
   *
   * The obvious spelling is `animate={{ maskImage: [from, to] }}`. Framer rejects
   * it, its target type has no `WebkitMaskImage`, and Safari needs the prefix.
   * Animating only the unprefixed property would leave Safari with a sentence
   * that never uncovers, which for this effect means a sentence never readable.
   *
   * So one number animates and both properties are derived from it through
   * `useMotionTemplate`: one driver, two outputs, always in step, and `style`
   * accepts the prefixed property where `animate` does not.
   */
  const stop = useMotionValue(0)
  const mask = useMotionTemplate`linear-gradient(${angle}, #000 ${stop}%, transparent calc(${stop}% + 16%))`

  useEffect(() => {
    if (reduced) return

    const el = ref.current
    if (!el) return

    /*
     * The mask is applied HERE rather than in the style prop, so that it exists
     * for exactly as long as the animation does. Between mount and this line the
     * element is plain text; after the `.then()` below it is plain text again.
     *
     * `maskSize`/`maskRepeat` are pinned because components/about-section.tsx
     * records that a gradient mask ending before 100% TILES by default and
     * repaints the very edge it was hiding. Both spellings, because a mask that
     * repeats in one engine only is the hardest kind of bug to notice.
     */
    stop.set(0)
    setArmed(true)
    el.style.maskSize = "100% 100%"
    el.style.maskRepeat = "no-repeat"
    el.style.webkitMaskSize = "100% 100%"
    el.style.webkitMaskRepeat = "no-repeat"
    el.style.willChange = "mask-image"

    // 130 rather than 100: the gradient's soft trailing edge is 16% wide, so the
    // stop has to travel past the end of the box for the last glyph to be fully
    // uncovered rather than left under the tail.
    const controls = animate(stop, 130, {
      duration: DUR.d6,
      delay: ms(delay),
      ease: FM_EASE.rule,
    })

    /* Defence 2. The mask is handed back to the stylesheet, which is the same
       "teardown restores, never reverts" rule ../sections.ts states. */
    controls.then(() => {
      const node = ref.current
      if (!node) return
      node.style.maskImage = ""
      node.style.webkitMaskImage = ""
      node.style.maskSize = ""
      node.style.maskRepeat = ""
      node.style.webkitMaskSize = ""
      node.style.webkitMaskRepeat = ""
      node.style.willChange = ""
    })

    /*
     * Stopping on unmount is not optional, a running animation keeps writing to
     * an element whose component has gone (../interactions.ts states it). The
     * mask is cleared here too, because a stop mid-sweep does not run the
     * `.then()` above and would otherwise strand the element part-uncovered.
     */
    return () => {
      controls.stop()
      setArmed(false)
      const node = ref.current
      if (!node) return
      node.style.maskImage = ""
      node.style.webkitMaskImage = ""
      node.style.willChange = ""
    }
  }, [reduced, delay, stop])

  /*
   * Defence 3. No Framer runtime, no mask, no client cost beyond this component's
   * own boundary, the element the server sent, unchanged.
   */
  if (reduced) {
    const Tag = as
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    )
  }

  const Motion = m[as as keyof typeof m] as typeof m.p

  return (
    <FmRoot>
      <Motion
        ref={ref as React.Ref<HTMLParagraphElement>}
        data-fm
        className={className}
        /*
         * Defence 1, and see the `armed` docblock above for the bug this shape
         * exists to prevent. Until the effect has run there is no `style` at all,
         * so the server's HTML, and every paint before hydration, is a plain
         * readable line with no mask on it.
         */
        style={armed ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
        {...rest}
      >
        {children}
      </Motion>
    </FmRoot>
  )
}
