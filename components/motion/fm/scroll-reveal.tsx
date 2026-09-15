"use client"

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react"
import { m, useTransform } from "motion/react"
import { FmRoot } from "./fm-root"
import { useScrubReveal } from "./use-scrub-reveal"

/**
 * A11, the general reversible reveal. The workhorse of the scroll layer.
 *
 * An element resolves as the reader descends toward it and un-resolves as they
 * return. Unlike every entrance that came before it on this site, it holds no
 * "already played" state: what the element looks like is a pure function of where
 * the reader is, so scrolling back up genuinely reverses it.
 *
 * ── WHY A SEPARATE COMPONENT FROM ../reveal.tsx ───────────────────────────────
 *
 * ../reveal.tsx is a SERVER pass-through that animates nothing. Its docblock is
 * emphatic about why: nine call sites render it, several only to pass `data-*`
 * through, and making it a client component again would drag all nine subtrees
 * across the boundary, which is the exact cost app/[locale]/layout.tsx:68-78 and
 * page.tsx:199-212 were written to avoid.
 *
 * That argument still stands, so this does not touch it. `Reveal` stays a server
 * component and stays free; THIS is opted into per element, at the places where
 * reversible motion is worth a client boundary. The two coexist deliberately.
 *
 * ── THE OWNERSHIP RULE APPLIES HERE IN FULL ───────────────────────────────────
 *
 * ./variants.ts states it: `data-anime` belongs to the vanilla layer, `data-fm`
 * to this one, and NO ELEMENT CARRIES BOTH. This component writes `transform` and
 * `opacity` from MotionValues, and ../dom.ts `setStyles` composes a single
 * `transform` string on the same properties, so an element with both hooks is
 * written by two engines and visibly fights itself at a rate that depends on
 * scroll speed.
 *
 * So: DO NOT wrap markup that already carries `data-anime`. Where this component
 * takes over an element, the vanilla recipe must be removed from it in the same
 * change, the four hand-offs already made are listed in ./variants.ts. The dev
 * audit in ./audit.tsx asserts `[data-anime][data-fm]` is empty and will fail
 * loudly in development if this is got wrong.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  ⚠️ A SCRUBBED VALUE *IS* SERIALISED INTO THE SSR HTML. MEASURED, NOT ASSUMED.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ./use-entrance.ts:95-101 says scroll-scrubbed animations need no safety gate,
 * because a `useTransform` of `scrollYProgress` is computed rather than written
 * into an `initial` prop, and "its value at progress 0 is the finished state by
 * design". THE FIRST HALF IS TRUE AND THE SECOND HALF IS THE TRAP.
 *
 * Framer renders a MotionValue's CURRENT value into the server HTML's style
 * attribute. For the effects that note was written about, ./hero-camera.tsx,
 * ./band-tone.tsx, progress 0 genuinely is the resting state, so what ships is
 * `transform:none` and nothing is hidden.
 *
 * A REVEAL INVERTS THAT. Its whole point is that progress 0 means "not yet
 * revealed", so the value serialised into the server HTML is the HIDDEN one. This
 * component shipped exactly that and it was caught by reading the rendered
 * markup:
 *
 *     <div data-fm style="opacity:0;transform:translateY(12px)">
 *
 * Every element below the fold on first paint, which for a reveal is most of
 * them, ships invisible. If the bundle 404s, throws before hydration, or is
 * stripped by a proxy, that content is invisible FOREVER. The `.no-js [data-fm]`
 * floor in styles/globals.css does not rescue it: that class is removed by an
 * inline script the moment scripting is confirmed, which happens long before the
 * bundle that failed would have run.
 *
 * That is the precise bug ./use-entrance.ts exists to prevent and that the
 * `.reveal` note at the end of styles/globals.css records this repo has ALREADY
 * SHIPPED ONCE.
 *
 * ── THE FIX: THE FROM-STATE IS ONLY EVER WRITTEN CLIENT-SIDE ──────────────────
 *
 * `armed` starts false and is set in an effect, which never runs on the server.
 * Until it flips, the output ranges are collapsed to the RESOLVED state, so the
 * serialised style is `opacity:1;transform:none`, the same no-JS floor every
 * other element on this site ships with. It is the `initial={false}` discipline
 * from ./use-entrance.ts, reached by collapsing a range instead of by a prop,
 * because a scrub has no `initial` to set to false.
 *
 * The honest cost is identical to the one that hook documents: one possible frame
 * of finished content before the scrub takes over. That trade is deliberate and
 * it is the right way round, one frame of CORRECT content, versus a bundle
 * failure that blanks the element permanently.
 *
 * `useEffect` rather than `useLayoutEffect`: a scrub has no committed from-state
 * to establish before paint, and `useLayoutEffect` warns during SSR.
 */

/** Block-axis travel, in px. Matches `RISE` in ../sections.ts. */
const RISE = 12

export type ScrollRevealProps = {
  children: ReactNode
  className?: string
  /** The rendered tag. `li`, `section` and `figure` are all in use. */
  as?: "div" | "li" | "section" | "figure" | "p" | "article" | "footer"
  /**
   * Travel distance in px. Pass 0 for an opacity-only reveal, correct for
   * anything whose position is load-bearing, such as a row in a measured grid.
   */
  rise?: number
  /**
   * Also release the element as it leaves through the top.
   *
   * OFF by default, and ./use-scrub-reveal.ts explains why at length: prose that
   * dims as the reader approaches the top of the viewport is prose fighting the
   * reader. Reserve it for figures, rules and decoration.
   */
  exit?: boolean
  /**
   * Override the reveal window, as `useScroll` offsets.
   *
   * ⚠️ NEEDED BY ANY ELEMENT AT THE VERY END OF THE DOCUMENT, in practice the
   * footer, and measured rather than assumed.
   *
   * The default window still assumes the element can travel until its bottom edge
   * reaches 80% of the viewport height. The LAST element on a page cannot: the
   * document stops scrolling while it is still near the bottom of the screen. The
   * site footer, scrolled as far as the page allows, attains a maximum progress of
   * 0.353, so with the default `ENTER_END` it parks at opacity 0.86 and never
   * resolves, on every route.
   *
   * `["start end", "start 60%"]` measures to the element's TOP edge instead, which
   * a footer does reach, so the window completes and the reveal resolves. Reach
   * for this only for that case; see ./use-scrub-reveal.ts for why a short window
   * is otherwise the wrong instinct.
   */
  offset?: [string, string]
  /**
   * Stagger, 0–1, as a fraction of the reveal window.
   *
   * ── WHY A SCRUBBED STAGGER IS NOT `stagger()` ────────────────────────────────
   *
   * The vanilla layer's `stagger()` delays each element in TIME, which has no
   * meaning for an animation whose playhead is scroll position, there is no
   * clock to delay against. The scroll equivalent is to shift each element's
   * window: a later sibling resolves at a later scroll position. Passing an index
   * fraction here does that, and it reverses correctly for free.
   */
  delay?: number
  /** Anything else, in practice `id` and `data-*`. NEVER `data-anime`. */
  [key: string]: unknown
}

export function ScrollReveal({
  children,
  className = "",
  as = "div",
  rise = RISE,
  exit = false,
  delay = 0,
  offset,
  ...rest
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement>(null)
  const { progress, reduced } = useScrubReveal(ref, { exit, offset })

  /*
   * THE SSR GUARD. See the ⚠️ block above, this is the whole defence.
   *
   * False on the server and on the first client render, so the from-state can
   * never reach the server HTML. Set in an effect, which runs only in a browser
   * that actually executed the bundle.
   */
  const [armed, setArmed] = useState(false)
  useEffect(() => setArmed(true), [])

  /* Reduced motion never arms either, so the element simply renders resolved and
     no scrubbed value is ever written to it. */
  const live = armed && !reduced

  /*
   * The stagger, applied by REMAPPING the window rather than by delaying.
   *
   * A `delay` of 0.2 means this element is still at zero when its siblings with
   * no delay have finished, and completes a fifth of the window later. Clamped so
   * a large index cannot push an element's completion past the end of its own
   * window and strand it permanently unresolved, the failure mode that matters,
   * since an unresolved element is an invisible one.
   */
  const shifted = useTransform(progress, [Math.min(delay, 0.6), 1], [0, 1], { clamp: true })

  /*
   * Opacity resolves FASTER than the travel, and that ordering is deliberate.
   *
   * Text that is still moving is text that cannot be read, but text that is
   * already opaque reads as settled even while a few pixels of travel remain. So
   * opacity finishes at 70% of the window and the transform carries the rest,
   * the element is legible well before it is geometrically finished.
   */
  const opacity = useTransform(shifted, [0, 0.7], live ? [0, 1] : [1, 1], { clamp: true })
  const y = useTransform(shifted, [0, 1], live ? [rise, 0] : [0, 0])

  /*
   * `filter` is NOT animated here, and that is a performance decision rather than
   * an aesthetic one. A blur forces a full-quality repaint of the element and its
   * subtree on every scrubbed frame, on every revealed element on the page. The
   * two properties below are compositor-only, which is the same reason
   * ../scroll.ts:55-60 gives for restricting the vanilla scrubs to opacity and a
   * uniform scale.
   */
  const Tag = m[as] as ElementType

  return (
    <FmRoot>
      <Tag
        ref={ref}
        data-fm
        className={className}
        style={{ opacity, y, willChange: live ? "transform, opacity" : undefined }}
        {...rest}
      >
        {children}
      </Tag>
    </FmRoot>
  )
}
