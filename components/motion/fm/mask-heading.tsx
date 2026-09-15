"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { m, animate, useInView, useMotionTemplate, useMotionValue, useReducedMotion } from "motion/react"
import { FmRoot } from "./fm-root"
import { useDirection } from "./use-direction"
import { DUR, FM_EASE } from "./tokens"

/**
 * A10, a section heading is UNCOVERED rather than faded in.
 *
 * A band of light sweeps across the type from its reading edge, with a soft 14%
 * trailing edge. The heading does not move, does not fade and is not rebuilt; one
 * CSS property animates on an element whose children are never touched.
 *
 * ── THIS IS THE HIGHEST-RISK ANIMATION ON THE SITE, AND WHY ────────────────────
 *
 * `mask-image` is not covered by the `[data-anime] { transform: none }` floor in
 * styles/globals.css, and a heading stranded mid-mask is not an unanimated
 * heading, it is INVISIBLE TEXT. Every other effect in this layer degrades to
 * "nothing happened"; this one degrades to "the section has no title".
 *
 * Four independent defences, and all four are required:
 *
 *   1. `rest` IS `mask-image: none`. Not a mask parked at a safe offset, no mask
 *      at all. So the resting state is an ordinary heading, which is what the
 *      server renders and what `useEntrance`'s deadline lands on.
 *   2. NO `initial` PROP. The mask is only ever applied after the element is in
 *      view, client-side. The SSR HTML carries no mask, so a failed bundle leaves
 *      a plain readable heading. This is the ./use-entrance.ts contract, and it is
 *      why this component does not use `initial`/`animate` the usual way round.
 *   3. `useReducedMotion()` returns the unmasked element with no Framer runtime.
 *   4. THE CSS FLOOR resets both `mask-image` and `-webkit-mask-image` under
 *      reduced motion. Both, because Safari needs the prefix and resetting one
 *      leaves the other applied.
 *
 * ── WHY A MASK AND NOT `background-clip: text` ────────────────────────────────
 *
 * ../hero.ts:180-193 records the bug in detail: `background-clip: text` clips to
 * the ELEMENT BOX, not to the glyphs. On a block-level heading the gradient's
 * opaque region sits past the end of the inked text, so the leading glyphs are
 * painted with the transparent tail, the subject's name rendered as "akik", and
 * rendered that way PERMANENTLY for anyone whose completion callback never fired,
 * such as a tab backgrounded during the delay.
 *
 * A mask composites against already-painted glyphs. There is no fill-colour
 * indirection and the failure mode does not exist.
 *
 * ── AND WHY NOT A PER-CHARACTER REVEAL ────────────────────────────────────────
 *
 * `splitText` is forbidden site-wide. ../sections.ts:136-140, ../section-header.tsx
 * and ../hero.tsx all state it: organisation names and the subject's own name must
 * render as single intact text nodes. scripts/check-publish-gate.mjs now enforces
 * it rather than leaving it to documentation.
 *
 * This animates one property on one element. `children` is passed through
 * untouched and is never inspected, split, wrapped or measured.
 *
 * ⚠️ NEVER APPLY THIS TO THE HERO <h1>. That element renders a real person's
 * name and ../hero.tsx:302-311 is explicit that it takes no animation hook at
 * all. This component is for `SectionHeader` only; the dev audit asserts it.
 */
export function MaskHeading({
  children,
  className,
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLHeadingElement>(null)
  const dir = useDirection(ref)

  /*
   * `once: false`, the heading uncovers on EVERY arrival, in step with the
   * vanilla entrances in ../sections.ts.
   *
   * ── THE OBJECTION THIS REPLACES, AND WHY IT DOES NOT APPLY ──────────────────
   *
   * This read `once: true`, on the argument that "re-masking a heading the reader
   * has already read would be taking content away from them". That is a real
   * hazard and it is answered by WHEN the mask is re-applied rather than by never
   * re-applying it: the re-mask happens only after the heading has left the
   * viewport entirely (see `amount: 0` on the exit gate below), so there is no
   * moment where a heading somebody is looking at loses its text. What they see on
   * return is an arrival, which is what the rest of the page now does too.
   *
   * `amount: 0.4` rather than the 0.15 the vanilla entrances use. A sweep this
   * long (DUR.d6, 1.65s) started the instant a heading's first pixel appears
   * would be half over before the heading is properly on screen.
   */
  const inView = useInView(ref, { amount: 0.4 })

  /*
   * A SECOND, LOOSER OBSERVER, AND IT IS WHAT MAKES THE REPLAY SAFE.
   *
   * `amount: 0` is true while any part of the heading is on screen, so it goes
   * false strictly later than `inView` does, only once the heading has cleared the
   * viewport completely. The re-mask is gated on THIS, not on `inView`.
   *
   * Gating on `inView` alone would re-mask at 40% visibility: a reader who scrolls
   * a heading two-thirds of the way off the top and stops would watch the visible
   * third blank itself. That is exactly the "taking content away" failure the old
   * `once: true` was protecting against, and this is the guard that removes the
   * need for it.
   */
  const onScreen = useInView(ref, { amount: 0 })

  /*
   * TWO FLAGS, AND THE SPLIT BETWEEN THEM IS LOAD-BEARING.
   *
   *   `swept`    has this heading already had its sweep since it was last off
   *              screen? Gates the TRIGGER, so one arrival cannot fire twice.
   *   `sweeping` is a sweep running RIGHT NOW? Gates the MASK STYLE, and nothing
   *              else.
   *
   * ⚠️ THEY CANNOT BE ONE FLAG, AND COLLAPSING THEM SHIPS INVISIBLE TEXT. That is
   * not hypothetical: this component was written with a single `swept` flag and
   * the dev audit in ./audit.tsx caught it within one scroll, "A HEADING IS STILL
   * MASKED 4000ms after its sweep started".
   *
   * The mechanism is worth stating exactly, because it is entirely invisible in
   * the single-flag version. The sweep's completion handler clears the mask by
   * writing `el.style.maskImage = ""` DIRECTLY on the node: it does not go
   * through React. With one flag, that flag is still true afterwards, so the very
   * next render (a resize, a parent state change, anything) re-applies
   * `style={{ maskImage: mask }}` from the motion template and the heading is
   * masked again, permanently, at whatever stop the value happens to hold.
   *
   * The old `once: true` concealed this: there was never a re-render after the
   * sweep because nothing about the component could change again. Making the sweep
   * repeat is what exposed it.
   *
   * So `sweeping` goes false the moment the sweep ends, and React's idea of the
   * style then agrees with the DOM write instead of fighting it.
   */
  const [swept, setSwept] = useState(false)
  const [sweeping, setSweeping] = useState(false)

  useEffect(() => {
    if (!onScreen && swept) {
      // The ref is the trigger guard, so re-arming the next sweep means
      // clearing it too, clearing only the state would leave the ref true
      // and the heading would never sweep again.
      sweptRef.current = false
      setSwept(false)
    }
  }, [onScreen, swept])

  /*
   * ⚠️ THE MASK IS REMOVED HERE, AFTER RENDER, NOT ONLY IN THE COMPLETION
   *    HANDLER. Measured: two headings on /en kept a mask without this.
   *
   * The completion handler clears `el.style.maskImage` imperatively, but it runs
   * inside a Motion callback rather than inside React's commit. It also calls
   * `setSweeping(false)`, which schedules a render, and that render re-applies
   * `style={{ maskImage: mask }}` if it is still reading `sweeping` as true, which
   * it is until the state actually lands. The imperative clear and the render then
   * race, and on the losing order the element keeps the mask forever, parked at
   * its finished 130% stop.
   *
   * That is not invisible text, a stop past 100% is opaque across the whole
   * element, so the heading reads correctly, but it IS the permanent
   * `mask-image` this component is explicit about never leaving behind: a
   * standing compositing cost, and a gradient that any later style recalculation
   * could reinterpret across text somebody is reading.
   *
   * Running the clear in an effect keyed on `sweeping` puts it AFTER the render
   * that stops applying the mask, so the two can no longer race: React removes the
   * style prop, then this removes anything the imperative path left behind.
   */
  useEffect(() => {
    if (sweeping) return
    const el = ref.current
    if (!el) return
    el.style.maskImage = ""
    el.style.webkitMaskImage = ""
    el.style.willChange = ""
  }, [sweeping])

  /*
   * ⚠️ A PHYSICAL ANGLE, AND THE ONE VALUE IN THIS FILE THAT NEEDS DIRECTION.
   *
   * The heading must uncover from the edge the reader starts at: left in English,
   * right in Arabic. A gradient angle is physical and the browser will not flip it.
   *
   * `to inline-end` would express this logically, but support is not universal
   * enough to rely on for a property whose failure mode is invisible text. An
   * explicit angle is the conservative choice here, and unlike the inline
   * `transform-origin` bug ../interactions.ts:96-120 documents, there is no
   * stylesheet rule being defeated, because the mask exists only in JS.
   */
  const angle = dir === "rtl" ? "270deg" : "90deg"

  /*
   * ── ONE MOTION VALUE, NOT AN ANIMATED PROPERTY, AND THE REASON IS TYPES ───────
   *
   * The obvious spelling is `animate={{ maskImage: [from, to] }}`. Framer rejects
   * it: its animation target type does not include `WebkitMaskImage`, and Safari
   * needs the prefix. Animating only the unprefixed property would leave Safari
   * with a heading that never uncovers, which, for this particular effect, means
   * a heading that is never readable.
   *
   * So a single number is animated instead and BOTH properties are derived from
   * it through `useMotionTemplate`. One driver, two outputs, always in step, and
   * `style` accepts the prefixed property where `animate` does not.
   *
   * It is also the better shape independently: the thing that actually moves here
   * is one gradient stop, and animating the number says that more directly than
   * interpolating two CSS strings.
   */
  const stop = useMotionValue(0)
  const mask = useMotionTemplate`linear-gradient(${angle}, #000 ${stop}%, transparent calc(${stop}% + 14%))`

  /*
   * ⚠️ THE TRIGGER GUARD IS A REF, NOT `swept`, AND THAT IS THE WHOLE SWEEP.
   *
   * `swept` is React state, so it belongs in this effect's dependency array. But
   * the effect SETS it on its first line. Depending on a value the effect itself
   * writes means React tears the effect down and re-runs it immediately, and the
   * teardown below calls `controls.stop()`.
   *
   * The result was a sweep killed before its first frame. The mask was applied,
   * the motion value stayed pinned at its starting 0, and the completion handler
   * that removes the mask never ran, because the animation never finished. A stop
   * of 0% is a gradient that is opaque nowhere: the heading was not "animating
   * slowly", it was INVISIBLE TEXT, indefinitely. Measured in the browser the mask
   * read `#000 0%, transparent calc(14%)` unchanged five seconds after arrival,
   * and the audit in ./audit.tsx reported it correctly every time.
   *
   * A ref does not participate in the dependency array and does not re-render, so
   * the guard can be read and written inside the effect without re-entering it.
   * `swept` remains as STATE only because the exit gate below needs a re-render to
   * re-arm it; the ref is what the trigger actually tests.
   */
  const sweptRef = useRef(false)

  useEffect(() => {
    if (!inView || sweptRef.current) return
    sweptRef.current = true
    setSwept(true)
    setSweeping(true)

    /*
     * Rewound to 0 before each sweep. The value is left at 130 by the previous
     * arrival, and animating from 130 to 130 is a no-op that would leave the
     * heading masked at its finished position, visible, but with the mask never
     * dropped, which is the standing compositing hazard the teardown below exists
     * to avoid.
     */
    stop.set(0)

    const controls = animate(stop, 130, { duration: DUR.d6, ease: FM_EASE.rule })

    /*
     * The mask is dropped entirely once the sweep finishes rather than left parked
     * at 130%. A heading carrying a permanent mask-image is a permanent
     * compositing cost and a standing hazard: any later style recalculation that
     * reinterprets the gradient risks clipping text somebody is reading.
     *
     * Removing it hands the element back to the stylesheet, which is the same
     * "teardown restores, never reverts" rule ../sections.ts:51-55 states for the
     * vanilla layer.
     */
    controls.then(() => {
      /* React first: `sweeping` false is what stops the next render re-applying
         the mask this handler is about to remove. See the two-flag note above,
         clearing only the DOM is the bug the audit caught. */
      setSweeping(false)
      const el = ref.current
      if (!el) return
      el.style.maskImage = ""
      el.style.webkitMaskImage = ""
      el.style.willChange = ""
    })

    /*
     * Stopping on unmount is not optional, a running animation keeps writing to
     * an element whose component has gone. ../interactions.ts:23-27 states it.
     *
     * AND THE MASK MUST COME OFF WITH IT. A sweep interrupted mid-flight never
     * reaches the completion handler above, so without this the element keeps a
     * half-drawn mask, which for this effect is a half-invisible sentence. The
     * teardown therefore repeats the cleanup rather than relying on it having run.
     */
    return () => {
      controls.stop()
      setSweeping(false)
      const el = ref.current
      if (!el) return
      el.style.maskImage = ""
      el.style.webkitMaskImage = ""
      el.style.willChange = ""
    }
    /*
     * `swept` is deliberately NOT a dependency, see the ref note above. It is
     * written by this effect, and depending on it re-entered the effect and
     * stopped the animation on the frame it started.
     */
  }, [inView, stop])

  /*
   * Reduced motion returns the plain heading with no Framer runtime beneath it,
   * no mask, no observer, no client boundary cost beyond this component's own.
   * Byte-identical to what the server sent.
   */
  if (reduced) {
    return (
      <h2 id={id} className={className}>
        {children}
      </h2>
    )
  }

  return (
    <FmRoot>
      <m.h2
        ref={ref}
        id={id}
        data-fm
        className={className}
        /*
         * NO `initial` AND NO MASK UNTIL THE SWEEP IS ARMED. The element renders
         * unmasked; the mask appears only once the effect above has something to
         * animate. So the first paint, and every paint before hydration, is a
         * plain readable heading. That is defence 2 in the docblock, and it is why
         * this component does not use the usual `initial`/`animate` pairing.
         *
         * ⚠️ GATED ON `sweeping`, AND IT MUST NOT BE `swept`. See the two-flag
         * note above: `swept` stays true for as long as the heading is anywhere on
         * screen, INCLUDING after the sweep has finished and the completion handler
         * has imperatively removed the mask. Gating here on `swept` therefore hands
         * Framer a mask to re-apply on the next render for any reason at all, from
         * a motion value parked at its finished stop, a permanent mask-image that
         * no animation will ever come back to clear. The audit reports it as
         * invisible text, and it is right to.
         *
         * `sweeping` is true for exactly the window in which a mask should exist:
         * set when the animation starts, cleared by both the completion handler and
         * the interrupt teardown. Neither of those paths can now be contradicted by
         * a later render.
         *
         * It is still NOT gated on `inView`, for the original reason: `inView` goes
         * false while the heading is still partly on screen, and gating on it would
         * strip the mask mid-sweep on a reader who reversed, the sweep would keep
         * running against an element with no mask left to reveal.
         *
         * `maskSize`/`maskRepeat` are pinned because
         * components/about-section.tsx records that a gradient mask ending before
         * 100% tiles by default and repaints the very edge it was hiding. Both
         * spellings, because Safari needs the prefix and a mask that repeats in
         * one engine only is the hardest kind of bug to notice.
         */
        style={
          sweeping
            ? {
                maskImage: mask,
                WebkitMaskImage: mask,
                maskSize: "100% 100%",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "100% 100%",
                WebkitMaskRepeat: "no-repeat",
                willChange: "mask-image",
              }
            : undefined
        }
      >
        {children}
      </m.h2>
    </FmRoot>
  )
}
