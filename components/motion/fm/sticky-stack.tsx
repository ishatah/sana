"use client"

import { useRef, type ReactNode } from "react"
import { m, useScroll, useSpring, useTransform } from "motion/react"
import { FmRoot } from "./fm-root"
import { SCRUB_SPRING } from "./tokens"
import { useEntrance } from "./use-entrance"

/**
 * A15, THE STICKY STACK. Cards pin and are overlaid by the card behind them.
 *
 * Each item in the list sticks at a fixed offset from the top of the viewport and
 * stays there while the next scrolls up over it. What the reader sees is a deck
 * being dealt onto itself: the current card held still and read, the next arriving
 * on top of it, the one below receding.
 *
 * This is the loudest structural effect on the site and it is deliberately
 * confined to LISTS OF PEERS, the roles ledger and the expertise wall. It is
 * wrong for prose, and the reason is worth stating because it is the thing that
 * makes this effect defensible rather than fashionable:
 *
 *   A stack asserts that its items are ALTERNATIVES, one thing at a time, each
 *   replacing the last. That is true of a list of positions held and false of a
 *   paragraph, where the previous sentence must stay available to the eye. Used on
 *   prose it does not merely look wrong, it hides text the reader is mid-way
 *   through.
 *
 * ── HOW IT DEGRADES, WHICH IS THE PART THAT MATTERS ───────────────────────────
 *
 * `position: sticky` is CSS. With no JavaScript at all the stack still works,
 * cards pin, cards overlap, the list is readable and complete. Everything this
 * component adds on top (the recede, the dim, the lift) is scrubbed decoration
 * over a layout that already stands up. That ordering is the three-layer model
 * ../sections.ts:33-59 states, and it is why the effect is expressible here at
 * all: the extreme part is the CSS, and the CSS cannot fail to load.
 *
 * Under reduced motion the sticky positioning is DROPPED rather than kept,
 * see `.stack-item` in styles/globals.css. Pinning is motion the reader did not
 * ask for even though no property is being animated, and a reader who has asked
 * for less of it should get a plain vertical list.
 *
 * ── THE SCRUB IS PER-CARD AND MEASURED AGAINST ITS OWN CROSSING ───────────────
 *
 * `useScroll({ target })` per item, not one progress value for the whole list.
 * A single list-wide progress would need each card to know its own index and the
 * list's length in order to carve out its slice, which means the component takes
 * two props that must agree with the DOM, the class of bug that only appears when
 * someone inserts an item in the middle. Per-card measurement has no such
 * coupling: a card added anywhere is correct with no other edit.
 *
 * ── THE OFFSETS, AND WHY NOT THE SHARED CONSTANTS ─────────────────────────────
 *
 * ./tokens.ts exports FM_BAND_OFFSET and FM_READ_OFFSET and both are wrong here.
 * A sticky element's `useScroll` target does not travel the way a normal element
 * does, it pins, so its start edge holds position while its end edge continues.
 * The window that matters is from the moment the card pins to the moment it is
 * fully covered, which is `["start 12%", "end 60%"]` measured against the pin
 * offset below. The shared constants frame a NORMAL crossing and would run the
 * scrub out long before the card is actually covered.
 */

/**
 * Where a card pins, as a viewport percentage from the top.
 *
 * Must agree with `--stack-pin` in styles/globals.css, which is what actually
 * positions the card. Stated in both places because CSS needs it as a length and
 * the scroll offset needs it as a percentage, and there is no way to share one
 * value across that boundary without a client read per card.
 */
const PIN_OFFSET: ["start 12%", "end 60%"] = ["start 12%", "end 60%"]

/** How far a covered card recedes, in px of block-axis travel. */
const RECEDE = 26

/** How far a covered card scales down. 0.94 at the bottom of the deck. */
const RECEDE_SCALE = 0.94

/** The floor a covered card dims to. Never 0, see the note in `StackItem`. */
const RECEDE_OPACITY = 0.38

export function StickyStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

export function StackItem({
  children,
  className,
  index,
}: {
  children: ReactNode
  className?: string
  index: number
}) {
  return (
    <FmRoot>
      <StackItemInner className={className} index={index}>
        {children}
      </StackItemInner>
    </FmRoot>
  )
}

function StackItemInner({
  children,
  className,
  index,
}: {
  children: ReactNode
  className?: string
  index: number
}) {
  const { reduced } = useEntrance()
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({ target: ref, offset: PIN_OFFSET })
  const progress = useSpring(scrollYProgress, SCRUB_SPRING)

  /*
   * REDUCED MOTION COLLAPSES THE RANGES, NOT THE HOOKS.
   *
   * ./use-entrance.ts:"Branch OUTPUT RANGES on this, never hook order." Every
   * hook above runs unconditionally; only the three ranges below change. The
   * spring still exists and still parks, it simply has nowhere to travel.
   */
  const y = useTransform(progress, [0, 1], reduced ? [0, 0] : [0, RECEDE])
  const scale = useTransform(progress, [0, 1], reduced ? [1, 1] : [1, RECEDE_SCALE])

  /*
   * THE DIM FLOOR IS NOT A TASTE DECISION.
   *
   * A covered card is still in the accessibility tree and still focusable, it
   * holds real links. Scrubbing it to 0 would make a focusable element invisible,
   * which is WCAG 2.4.11 (focus not obscured) failing in the one case a keyboard
   * reader would actually hit it. At 0.38 against this ground the text stays above
   * 4.5:1, so a card that is visually behind another is still a card a screen
   * reader user can tab into and a sighted keyboard user can see receive focus.
   *
   * The deck depth is bounded for the same reason: `z-index` is the card's own
   * index, so a later card always paints over an earlier one and the stack has a
   * defined order rather than relying on source order alone.
   */
  const opacity = useTransform(progress, [0, 1], reduced ? [1, 1] : [1, RECEDE_OPACITY])

  return (
    <m.div
      ref={ref}
      className={className}
      /*
       * `transformOrigin` on the BLOCK axis only ("center top"). The card scales
       * toward its own pinned top edge, so the pin holds still while the body
       * recedes. No inline-axis term, so nothing to mirror for RTL, the
       * direction-safe-by-construction case ./use-direction.ts describes.
       *
       * It lives INSIDE `style` rather than as a prop: Framer's `HTMLMotionProps`
       * exposes transform components (`x`, `rotate`, …) as top-level props but
       * `transformOrigin` is a plain CSS property and only exists on `style`.
       */
      style={{ y, scale, opacity, zIndex: index, transformOrigin: "center top" }}
    >
      {children}
    </m.div>
  )
}
