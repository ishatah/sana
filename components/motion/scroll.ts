import { animate, scroll } from "motion"
import type { Handle } from "./dom"

/**
 * The two ways this site reacts to scrolling, and the boundary between them.
 *
 * ── DISCRETE vs SCRUBBED ───────────────────────────────────────────────────────
 *
 * `inViewRepeat` fires an entrance when a band arrives and re-arms it when the band
 * leaves; the animation then runs on its own clock and settles. `linkProgress` ties
 * an animation's playhead to scroll position, so it advances and reverses with the
 * reader's own movement and never settles anywhere except where they stop.
 *
 * Almost everything on this site is the first kind. The second is reserved for the
 * three places where scroll position is itself the information: how far through the
 * roles ledger you have read, how far into a band you are, and the hero's depth as
 * it leaves.
 *
 * ── DISCRETE DOES NOT MEAN ONCE ────────────────────────────────────────────────
 *
 * It used to. `onceInView` fired a single arrival per page visit and `entrance()`
 * in ./sections.ts held a `fired` latch to enforce it, so a reader who scrolled
 * back up met a page that had already finished moving. Both are gone: an entrance
 * now plays on every arrival and reverses its direction to match the edge the
 * reader arrived by. What still separates the two kinds is the CLOCK, a discrete
 * entrance runs on its own once triggered, a scrubbed one never leaves the
 * reader's hand.
 *
 * ── WHY THE OFFSET STRINGS LIVE HERE ───────────────────────────────────────────
 *
 * Motion's offset syntax ("start end", "end start") is quick to write and hard to
 * read six months later, and getting one backwards produces an animation that
 * silently never fires. Naming the two configurations this site actually uses means
 * there are two things to get right rather than one per call site.
 */

/** Stops one observer. Every function here returns one, and it must be called. */
export type ScrollHandle = () => void

/**
 * Which edge of the viewport the element is on, at the moment it is asked.
 *
 * "below" means the element sits past the bottom of the viewport, the reader is
 * approaching it by scrolling DOWN. "above" means it has passed out through the
 * top, the reader is returning to it by scrolling UP. Measured from the rect
 * rather than tracked from a scroll delta, because what an entrance needs to know
 * is where the element IS relative to the reader, not which way the page last
 * happened to move: a jump-link, a resize or a browser restoring scroll position
 * all move the element without producing the scroll events a delta tracker reads.
 */
export type Edge = "above" | "below"

export function edgeOf(target: Element): Edge {
  return target.getBoundingClientRect().top < 0 ? "above" : "below"
}

/**
 * Run an entrance EVERY time `target` arrives, and re-arm it every time it leaves.
 *
 * ── WHY THIS EXISTS BESIDE `onceInView` ────────────────────────────────────────
 *
 * `onceInView` plus the `fired` latch in ./sections.ts gave every band a single
 * arrival per page visit: scroll past a section and back, and it was already
 * finished. That is the conventional choice and it is defensible, animating
 * content the reader has already read can be worse than not animating it, but it
 * makes the page feel inert on the way back up, which is the half of the journey a
 * reader spends re-finding something.
 *
 * So the contract is now symmetric: `onEnter` runs on arrival, `onExit` runs when
 * the band has left, and both receive the EDGE they happened at. An entrance that
 * knows it is being re-entered from above can come from above, the gesture
 * reverses with the reader rather than replaying identically in a direction that
 * no longer matches where they came from.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  ⚠️ WHY THIS IS NOT `inView`, AND WHY IT IS NOT A RATIO. MEASURED, NOT ASSUMED.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * The obvious implementation is `inView(target, onEnter)` with `amount: 0.15`,
 * using the cleanup callback it returns as the exit. That was written, and it
 * silently never re-armed a single band. The reason is worth recording, because
 * every `amount`/`threshold` API on the platform has the same trap in it.
 *
 * AN INTERSECTION RATIO IS A FRACTION OF THE ELEMENT, NOT OF THE VIEWPORT. A band
 * taller than the screen can never reach a high one. Measured on this site's own
 * About band at a 643px viewport:
 *
 *     section height  2081px
 *     max ratio       643 / 2081 ≈ 0.31
 *
 * So `amount: 0.15` sits at HALF the maximum this element can ever attain, close
 * enough to the ceiling to be fragile, and any threshold above 0.31 would never
 * fire at all. Worse for the exit: scrolled to the very top of the document, that
 * band's top edge is 29px below the fold, so it is STILL INTERSECTING at ratio 0.
 * It never "fully leaves", the cleanup's `gone` test never passed, and the
 * re-arm never happened. The page looked exactly as it had before the change.
 *
 * ── WHAT IS USED INSTEAD: A TRIGGER LINE, NOT A PROPORTION ────────────────────
 *
 * `rootMargin` shrinks the viewport to a band across its middle, and intersection
 * with THAT is the signal. It is a question about position, has this element
 * reached the reader's attention zone, which is the question an entrance actually
 * wants, and its answer does not depend on the element's height at all. A 200px
 * row and a 2000px section behave identically, which is why no recipe in
 * ./sections.ts needs to know how tall its band is.
 *
 * ENTER and EXIT get DIFFERENT lines, and the gap between them is deliberate:
 *
 *   ENTER  −25% from the bottom: the band has come a quarter of the way up the
 *          screen, so the entrance starts as the reader approaches rather than
 *          after they are already reading it.
 *   EXIT   the element must clear the viewport's own edge entirely.
 *
 * That gap is HYSTERESIS and it is the point. With one shared line, a reader
 * resting exactly on it would see the band re-arm and replay repeatedly on every
 * sub-pixel scroll, the flicker that makes replayed entrances feel broken rather
 * than alive. Two lines mean a band that has arrived stays arrived until the
 * reader has genuinely left it behind.
 */
const ENTER_MARGIN = "0px 0px -25% 0px"

export function inViewRepeat(
  target: Element,
  onEnter: (edge: Edge) => void,
  onExit: (edge: Edge) => void,
): ScrollHandle {
  if (typeof IntersectionObserver === "undefined") return () => {}

  /*
   * Tracked explicitly rather than read from `entry.isIntersecting`, because the
   * two observers below fire independently and each must only report a CHANGE.
   * Without this an enter observer that re-fires, a resize, a layout shift, a
   * threshold re-crossed by a scrollbar appearing, would restart an entrance the
   * reader is already watching.
   */
  let inside = false

  const enterObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || inside) continue
        inside = true
        onEnter(edgeOf(target))
      }
    },
    { rootMargin: ENTER_MARGIN, threshold: 0 },
  )

  /*
   * The exit observer uses NO margin, so it reports the element's relationship to
   * the real viewport edge. `isIntersecting` false here means the band is
   * genuinely off screen, the outer line of the hysteresis pair described above.
   */
  const exitObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting || !inside) continue
        inside = false
        // `boundingClientRect` rather than a fresh measurement: this is the
        // geometry at the moment the crossing was observed, which is what decides
        // which edge the reader left by.
        onExit(e.boundingClientRect.bottom <= 0 ? "above" : "below")
      }
    },
    { threshold: 0 },
  )

  enterObserver.observe(target)
  exitObserver.observe(target)

  return () => {
    enterObserver.disconnect()
    exitObserver.disconnect()
  }
}

/**
 * Tie an animation's playhead to how far `target` has travelled through the
 * viewport.
 *
 * ── THERE IS NO SMOOTHING OPTION, AND THAT IS A REAL DIFFERENCE ────────────────
 *
 * anime.js's ScrollObserver took `sync: 0.25`, a quarter-second of easing applied
 * to the scrub itself, which took the edge off a trackpad's sub-pixel deltas.
 * Motion's `scroll()` has no equivalent: its ScrollOptions are source, container,
 * target, axis and offset, and nothing else. Passing `smooth` is silently ignored
 * at runtime and rejected by the types.
 *
 * What replaces it is choosing properties that do not show the judder. Every
 * scrubbed animation on this site drives `opacity` or a uniform `scaleY`, both of
 * which are compositor-only and visually forgiving of a few sub-pixel steps. The
 * one effect where per-frame jitter would have been visible, a translate on the
 * hero portrait, is deliberately small for the same reason.
 *
 * THE ANIMATION PASSED IN MUST BE LINEAR. Motion advances the playhead in
 * proportion to scroll, so any easing on the animation is applied ON TOP of that
 * proportion and the element is no longer where the reader is, which defeats the
 * only reason to link it to scroll. `linear()` below exists so no call site has to
 * remember.
 */
export function linkProgress(
  target: Element,
  animation: Handle,
  opts: { offset?: [string, string] } = {},
): ScrollHandle {
  const { offset = ["start end", "end start"] } = opts
  return scroll(animation as never, {
    target,
    offset: offset as never,
  })
}

/**
 * A band's own progress: 0 as its top reaches the bottom of the viewport, 1 as its
 * bottom leaves the top. Used by the tone wash, which peaks mid-band.
 */
export const BAND_OFFSET: [string, string] = ["start end", "end start"]

/**
 * A list's READING progress, which is not the same thing as its band progress: 0
 * just before the list's top reaches the reading zone, 1 as its bottom leaves it.
 * Tighter than BAND_OFFSET so the rail is genuinely full by the time the last row
 * has been read, rather than at some point after the list has scrolled away.
 */
export const READ_OFFSET: [string, string] = ["start 85%", "end 55%"]

/**
 * An animation built solely to be scrubbed by `linkProgress`.
 *
 * `duration: 1` is nominal, a scrubbed animation's playhead is driven by scroll
 * position, not by time, so the number only has to be non-zero. `ease: "linear"` is
 * the part that matters; see the note above.
 */
export function linear(target: Element | Element[], values: Record<string, unknown>): Handle {
  return animate(target as never, values as never, { ease: "linear", duration: 1 }) as unknown as Handle
}
