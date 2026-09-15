"use client"

import { useRef, type ReactNode } from "react"
import { m, useMotionValue, useSpring, useTransform, useReducedMotion, type MotionValue } from "motion/react"
import { TRAVEL_SPRING } from "./tokens"
import { useFinePointer } from "./use-media"

/**
 * The expertise card: a glass panel that leans toward the pointer.
 *
 * ── THIS REVERSES A DOCUMENTED DELETION, AND SAYS SO ───────────────────────────
 *
 * ../interactions.ts records the removal of `magneticCards`, "cards that leaned
 * toward it", on four grounds: the motion promised an affordance that did not
 * exist, it forced `tabIndex` onto static elements, it was invisible on touch,
 * and lift-toward-cursor is a stock effect.
 *
 * The client has since asked for it back, having been shown the conflict with
 * data/exclusions.json (`promotional-tone`: `تجنّب ... العناصر الحركية الزائدة`
 * against a requested character of `رسمي · قيادي`). That is a client decision
 * rather than a finding that the four objections were wrong, so three of them are
 * ANSWERED here rather than dismissed:
 *
 *   1. NO `tabIndex`. The card is not focusable and never becomes so. There is
 *      deliberately no keyboard branch of this effect: an effect that cannot be
 *      reached without a pointer must not manufacture a tab stop in order to be
 *      reachable. That was the specific accessibility cost the removal note
 *      objected to, seven dead stops in the tab order, and it is not paid twice.
 *      See the docblock in components/expertise-grid.tsx, reason 3.
 *
 *   2. TOUCH GETS NOTHING AND COSTS NOTHING. `useFinePointer()` collapses both
 *      output ranges to zero, so a finger drives no transform at all. Same gate,
 *      in hook form, that ../interactions.ts puts on `navUnderline`.
 *
 *   3. THE AFFORDANCE OBJECTION IS THE HONEST RESIDUAL. These cards are still not
 *      clickable. What answers it is the CHOICE OF GESTURE: there is no lift, no
 *      scale and no shadow bloom under the card, because a box that grows toward
 *      you reads as a button offering to be pressed. A plane that rotates in place
 *      reads as a surface catching light, which is what this is.
 *
 * ── THE OWNERSHIP SPLIT, AND WHY THE CARD IS A THIRD ELEMENT ───────────────────
 *
 * ./variants.ts states the rule: every `data-anime` hook is owned by
 * ../sections.ts, every `data-fm` hook by this directory, and NO ELEMENT CARRIES
 * BOTH. The <li> above this already carries `data-anime="panel"` and `markWall`
 * in ../sections.ts writes its opacity.
 *
 * That is not merely a tidiness rule here. `entrance()` in ../sections.ts tears
 * down with `clearStyles(targets)`, which wipes the element's whole inline style
 * surface, it does not know which properties it wrote. A Framer transform on
 * that node would be erased mid-flight by a cleanup that has never heard of it.
 *
 * So the card is a SEPARATE, NESTED element writing only `transform`. Three
 * elements, three owners, one writer each: the <li> (vanilla, opacity), the mark
 * (this layer, scaleX), this card (this layer, rotate).
 *
 * ── PERSPECTIVE SITS ON THE PARENT ────────────────────────────────────────────
 *
 * `perspective` describes the camera, not the subject, so it goes on the wrapper
 * rather than on the rotating element, without it `rotateX`/`rotateY` flatten
 * and the effect silently degrades to nothing.
 *
 * It is a plain <div> rather than the <li> on purpose: `perspective` establishes
 * a containing block, and the <li> is the element the vanilla layer is writing
 * inline styles onto. Giving it a containing block it did not ask for is the kind
 * of coupling that surfaces later as an unexplainable positioning bug.
 */

/**
 * The tilt ceiling, in degrees.
 *
 * ── SIX, AND THE CEILING IS THE DESIGN ────────────────────────────────────────
 *
 * ./mark-rail.tsx makes this argument for its 1.6° shear and ../hero.ts makes it
 * for the 8px portrait drift: every stock version of this effect runs 8-15°,
 * which is exactly what makes it legible AS an effect, you see the card flip and
 * you recognise the technique. At 6° the card does not visibly flip; it fails to
 * be perfectly flat, which registers as a surface with a sheen on it.
 *
 * Raising this is the single fastest way to undo the work, and it is the value
 * that would push the card into the register data/exclusions.json rules out.
 */
const TILT = 6

export function ExpertiseCard({
  children,
  shutterY,
}: {
  children: ReactNode
  /**
   * #25, the rolling-shutter offset for this row, in px, supplied by
   * ./mark-rail.tsx.
   *
   * ── WHY IT ARRIVES HERE RATHER THAN BEING APPLIED WHERE IT IS COMPUTED ──────
   *
   * The <li> that owns the row carries `data-anime="panel"`, and the ownership
   * rule in ./variants.ts is that no element carries both a vanilla and a Framer
   * hook. That is not tidiness: `entrance()` in ../sections.ts tears down with
   * `clearStyles`, which wipes an element's whole inline style surface, so a
   * transform written there by this layer would be erased mid-flight.
   *
   * This card is already the row's Framer-owned element and is already writing a
   * transform, so the shutter composes into that one rather than needing an
   * element of its own.
   *
   * Optional, because the reduced-motion branch of ./mark-rail.tsx renders this
   * card with no scroll machinery behind it at all.
   */
  shutterY?: MotionValue<number>
}) {
  const reduced = useReducedMotion()
  const fine = useFinePointer()
  const ref = useRef<HTMLDivElement>(null)

  /*
   * Hooks run unconditionally and only the OUTPUT RANGES branch, the pattern
   * ./hero-camera.tsx uses. An early return before a hook would change the hook
   * order between renders the moment the media query resolves.
   */
  const active = !reduced && fine

  /*
   * Pointer position on the card, normalised to -0.5 … 0.5 on each axis with 0 at
   * the centre.
   *
   * NORMALISED RATHER THAN RAW PIXELS, because these cards are grid cells whose
   * width changes with the breakpoint. A degree-per-pixel mapping would make a
   * four-column card lean half as far as the same card at one column, so the
   * effect would quietly change strength as the layout reflowed.
   */
  const px = useMotionValue(0)
  const py = useMotionValue(0)

  /*
   * ── THE SPRING IS THE "PHYSICAL" PART, AND IT IS A PERSISTENT SYSTEM ──────────
   *
   * `useSpring` holds one spring per axis whose TARGET is updated as the pointer
   * moves. Velocity carries across those updates, which is what makes the card
   * settle rather than step: the surface is still moving when the next target
   * arrives.
   *
   * The alternative, calling `animate()` on every `pointermove`, starts a new
   * animation per frame, each from velocity zero. That reads as a stutter, not a
   * settle, and it is why this is in the Framer layer rather than as a vanilla
   * recipe in ../interactions.ts.
   *
   * TRAVEL_SPRING is ζ ≈ 1.05, just past critical, so it approaches its target
   * and never crosses it. There is no overshoot and no bounce, which ./tokens.ts
   * documents as a requirement rather than a taste: a visible bounce is precisely
   * the `العناصر الحركية الزائدة` that intake section 3 rules out. This is its
   * first call site.
   */
  const sx = useSpring(px, TRAVEL_SPRING)
  const sy = useSpring(py, TRAVEL_SPRING)

  /*
   * THE SIGNS ARE THE EASIEST THING TO GET WRONG HERE, because a card with both
   * inverted still animates smoothly, it just leans away from the cursor, which
   * looks like a repulsion effect rather than a bug.
   *
   *   rotateY: pointer RIGHT of centre lifts the right edge toward the reader, so
   *            the mapping is positive.
   *   rotateX: pointer BELOW centre lifts the bottom edge toward the reader, and
   *            on the X axis that is NEGATIVE rotation, hence the inverted pair.
   *
   * NOT MIRRORED FOR RTL, deliberately. Pointer deltas are viewport-physical: a
   * surface tilts toward wherever the pointer actually is, and that is the same
   * fact in both languages. A direction multiplier here would be the dead-
   * multiplier mistake ../interactions.ts deletes and ./use-direction.ts warns
   * about. The only direction-dependent value on this card is the edge gradient's
   * angle, and that is handled in the stylesheet where the mirror already lives.
   */
  const rotateY = useTransform(sx, [-0.5, 0.5], active ? [-TILT, TILT] : [0, 0])
  const rotateX = useTransform(sy, [-0.5, 0.5], active ? [TILT, -TILT] : [0, 0])

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return
    const el = ref.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const nx = (event.clientX - rect.left) / rect.width
    const ny = (event.clientY - rect.top) / rect.height

    px.set(nx - 0.5)
    py.set(ny - 0.5)

    /*
     * The specular bloom is written as CSS CUSTOM PROPERTIES rather than through
     * a MotionValue, for one hard reason and one soft one.
     *
     * HARD: the bloom is painted by `.glass-card::after`, and a pseudo-element
     * cannot be a Framer target, there is no node to attach a MotionValue to.
     * A custom property on the host element is how you animate one.
     *
     * SOFT: these are set from the RAW pointer position, not from the sprung
     * values above. The highlight is the light source and the card is the surface
     * moving under it; routing the light through the same spring would make the
     * reflection lag the tilt, which is the one combination that reads as broken
     * rather than as physical.
     */
    el.style.setProperty("--glass-x", `${nx * 100}%`)
    el.style.setProperty("--glass-y", `${ny * 100}%`)

    /*
     * ── #4 + #7 + #26, THE TILT MAGNITUDE, PUBLISHED FOR THE STYLESHEET ────────
     *
     * Three effects in styles/globals.css need to know how oblique this card
     * currently is: the Fresnel edge flare, the thin-film hue rotation, and the
     * anamorphic streak. All three are painted on `::before` or `::after`, and a
     * pseudo-element cannot be a Framer target, so the magnitude is published as
     * a custom property for the same hard reason the bloom position is.
     *
     * 0 at centre, 1 at a corner. `Math.hypot` rather than the larger of the two
     * axes: a card held at a corner is more oblique than one held at an edge, and
     * the diagonal is what the eye actually reads as "tilted".
     *
     * Normalised by the half-diagonal of the 0.5-square (≈0.707) so a corner
     * reaches exactly 1 and the stylesheet's coefficients can be read as their
     * literal maximum contribution.
     *
     * RAW, NOT SPRUNG, the same argument as the bloom above. The edge flare is
     * the light's response to the surface angle, and light does not lag. Routing
     * it through the tilt spring would make the edge brighten after the card has
     * finished moving, which is the one combination that reads as broken.
     */
    const tilt = Math.min(Math.hypot(nx - 0.5, ny - 0.5) / 0.7071, 1)
    el.style.setProperty("--tilt", tilt.toFixed(3))
  }

  /*
   * ── THE RESET IS BOUND TO THREE EVENTS, NOT ONE ──────────────────────────────
   *
   * `pointerleave` alone leaves the card tilted in two real cases:
   *
   *   - `pointercancel`, which the browser fires instead of a leave when the
   *     system takes the pointer away, a touchpad gesture starting, a context
   *     menu opening, the window losing focus mid-move.
   *   - any path where the enter was never paired, which React's synthetic
   *     leave will not fire for at all.
   *
   * A card frozen at 4° with the pointer somewhere else is the one failure mode
   * a reader would actually notice, and it does not self-correct, the spring has
   * already settled at its target, so nothing schedules another frame. Binding the
   * same handler to all three costs nothing and removes the whole class.
   */
  const onPointerLeave = () => {
    px.set(0)
    py.set(0)

    /*
     * `removeProperty`, not a write of "50%". Clearing the inline value returns
     * the card to the position the STYLESHEET declares, which is the same floor
     * used with no JS, on touch and under reduced motion. Writing the number here
     * would fork that default into two places that could drift apart, the
     * discipline every cleanup in ../interactions.ts follows.
     */
    const el = ref.current
    el?.style.removeProperty("--glass-x")
    el?.style.removeProperty("--glass-y")
    /* Cleared, not written to "0", for the reason stated immediately above: the
       stylesheet declares `--tilt: 0` on `.glass-card` and that stays the single
       source of the resting state. */
    el?.style.removeProperty("--tilt")
  }

  return (
    <div
      className="h-full"
      /*
       * The camera. Only when the effect is live: under reduced motion or on
       * touch there is nothing to project, and a perspective on a non-rotating
       * subtree is a containing block bought for nothing.
       */
      style={active ? { perspective: 900 } : undefined}
    >
      <m.div
        ref={ref}
        data-fm
        className="glass-card h-full"
        /*
         * `y` is the rolling-shutter offset (#25) and is composed here rather
         * than on the row, for the reason given in the prop docblock above.
         * Framer writes all three into one transform, so there is still exactly
         * one writer on this element.
         */
        style={{ rotateX, rotateY, y: shutterY }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerLeave}
        onLostPointerCapture={onPointerLeave}
      >
        {children}
      </m.div>
    </div>
  )
}
