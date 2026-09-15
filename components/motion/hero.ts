import { animate, stagger } from "motion"
import { DUR, EASE, ms } from "./tokens"
import { setStyles, clearStyles, type Handle } from "./dom"

/**
 * The hero's motion, and the only motion left on the page that is not driven by a
 * click.
 *
 * ── WHY THIS IS NOT THE SCROLL MOTION THAT WAS REMOVED ─────────────────────────
 *
 * Every animation here fires ONCE, on load, from a known state. None of it is
 * triggered by scrolling, none of it observes the viewport, and none of it runs on
 * a loop. That distinction is the whole design: the scroll-triggered entrances and
 * the one-section-per-gesture controller were removed because they took the page
 * away from the reader, and nothing in this file can do that, by the time a
 * visitor has scrolled at all, everything here has finished and will not run again.
 *
 * ── THE FLOOR ──────────────────────────────────────────────────────────────────
 *
 * The hero is fully readable with this file absent, failed, or refused. The markup
 * ships complete and visible from the server; these animations only ADD a starting
 * offset and then remove it. That ordering matters and is the opposite of how
 * entrance animations are usually built: the common pattern hides elements in CSS
 * and reveals them in JS, which renders a blank hero whenever the JS does not
 * arrive. Here the from-state is written by the same code that animates it away, so
 * a bundle that never loads leaves the content exactly where it already was.
 *
 * ── UNITS, WHICH ARE THE ONE REAL HAZARD IN THIS FILE ──────────────────────────
 *
 * Motion takes `duration` and `delay` in SECONDS. The choreography below is
 * authored in MILLISECONDS, because "the rule lands at 320" is how a sequence is
 * read and reasoned about. Every crossing of that boundary goes through `ms()`
 * from ./tokens, a raw millisecond number reaching Motion does not throw, it just
 * schedules the hero to assemble over the next several minutes.
 */

/** How far each element travels on entry. Small on purpose, a long slide reads as
 *  a page assembling itself, which is the template effect this avoids. */
const RISE = 18

/**
 * The order the hero assembles in, and the reason it is this order.
 *
 * It follows READING order, not visual weight: the eyebrow names the subject, the
 * name lands, the role qualifies it, the title and the
 * detail follow, and the CTAs arrive last because an action offered before its
 * context is an advert. The portrait fades in alongside the name rather than after
 * everything else, it is the other half of the same statement.
 *
 * `at` is in MILLISECONDS. See the units note above.
 */
const SEQUENCE: Array<{ selector: string; at: number }> = [
  { selector: '[data-anime="eyebrow"]', at: 0 },
  { selector: '[data-anime="name"]', at: 90 },
  { selector: '[data-anime="role-lead"]', at: 210 },
  /*
   * `[data-anime="hero-title"]` IS DELIBERATELY ABSENT, AND THIS NOTE IS THE
   * REASON, do not add it back.
   *
   * The full legal title used to sit here at 390. It is now uncovered by a mask
   * sweep instead (components/motion/fm/sweep-text.tsx), which holds that same
   * 390 beat through its own `delay` prop, so the SEQUENCE is unchanged and only
   * the effect at that position differs.
   *
   * Two writers on one element is the failure this avoids. `entrance()` below
   * writes an inline `transform` and `opacity` synchronously via `setStyles`;
   * the sweep writes `mask-image`. Both on the same node means the vanilla layer
   * animating a line the mask is still hiding, and, worse, `clearStyles` in
   * this file's teardown would run against an element the Framer component also
   * cleans up. See components/motion/fm/variants.ts for the ownership rule.
   */
  // One hook where there were three. The roles list, the stat bar and the
  // locations list were separate blocks with separate entrances; they are now a
  // single meta row, so they arrive together as one object rather than as three
  // things queueing up.
  { selector: '[data-anime="hero-meta"]', at: 480 },
  /*
   * THE CELLS INSIDE THE META ROW, ON THEIR OWN BEAT.
   *
   * The entry above fades the <dl> in as one object. This one matches the three
   * <div> cells inside it, and because `stagger()` below spaces anything a
   * selector matches more than once, they arrive 70ms apart, the row assembles
   * across the reading direction instead of appearing whole.
   *
   * IT STARTS AFTER THE ROW IT IS INSIDE, not with it. At 480 the parent is
   * still at opacity 0, so a child animating then would be invisible for its own
   * entrance and simply be there once the parent caught up. 540 puts the cells
   * just behind their container.
   *
   * THE NESTING IS SAFE because the two writers touch different NODES: the <dl>
   * and the <div>s inside it. Opacity multiplies down the tree, so the parent's
   * fade and the child's fade compose rather than fight, which is exactly what
   * two writers on the SAME node would do. This is the same ownership rule the
   * portrait obeys by splitting its entrance and its camera across two wrappers.
   */
  { selector: '[data-anime="meta-item"]', at: 540 },
  { selector: '[data-anime="hero-cta"]', at: 580 },
  // The signed statement under the portrait. Last, and after the CTAs: it is the
  // closing remark of the band, so it arrives once the rest has settled rather
  // than competing with the name for the opening beat.
  { selector: '[data-anime="hero-statement"]', at: 660 },
]

/** Milliseconds between two elements matched by the same selector. */
const STAGGER = 70


/**
 * Mounts every hero behaviour. Returns a teardown that reverts each one.
 *
 * The caller (components/motion/hero-scope.tsx) is responsible for the
 * reduced-motion check, this is never called when the visitor has asked for less
 * motion, so nothing here needs its own guard.
 */
export function mountHero(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = []

  /*
   * ONE BEHAVIOUR LEFT HERE, AND THAT IS THE POINT.
   *
   * This file mounted three: the entrance, the role rotation and the portrait
   * drift. The last two moved to the Framer layer (components/motion/fm/) and
   * were DELETED here rather than left dormant, see the two docblocks below for
   * each, and components/motion/fm/variants.ts for why a dormant copy is not a
   * safe state.
   *
   * What remains is exactly what this file's own docblock describes: an entrance
   * that fires once, on load, from a known state, and settles. Nothing here
   * observes the scroll position any more.
   */
  cleanups.push(entrance(root))

  return () => cleanups.forEach((fn) => fn())
}

/**
 * The staggered entrance.
 *
 * `setStyles` writes the from-state immediately and SYNCHRONOUSLY, then each
 * element animates back to rest. Because this runs in an effect, after first
 * paint, there is a frame where the content is already at its final position, and
 * that is the correct trade: a brief correct state is better than a hidden one, and
 * it is what guarantees the no-JS floor described at the top of this file.
 *
 * The synchronous part is load-bearing and is why this does not use a Motion
 * keyframe array (`opacity: [0, 1]`) to declare the from-state instead. A keyframe
 * array applies on the next animation frame; between the effect running and that
 * frame the element would paint at its REST state, then jump back to the offset to
 * animate in. Writing the style directly closes that window.
 */
function entrance(root: HTMLElement): () => void {
  const targets: Element[] = []
  const running: Handle[] = []

  for (const { selector, at } of SEQUENCE) {
    const els = Array.from(root.querySelectorAll(selector))
    if (!els.length) continue
    targets.push(...els)

    setStyles(els, { opacity: 0, y: RISE })
    running.push(
      animate(
        els,
        { opacity: 1, y: 0 },
        {
          duration: DUR.d5,
          /*
           * `stagger` REPLACES the hand-written index function this used to carry.
           *
           * Under anime.js the delay was `(_target, i) => at + i * 70`, plus a long
           * comment explaining why both parameters had to be declared optional to
           * satisfy that library's `FunctionValue` overload. Motion has a first-
           * class stagger with a start offset, so the whole overload problem and the
           * note explaining it are gone: `startDelay` is the sequence position and
           * the stagger spaces anything the selector matched more than once.
           */
          delay: stagger(ms(STAGGER), { startDelay: ms(at) }),
          // A long, decelerating ease. The motion is almost over by the time the eye
          // reaches it, so what registers is the settle rather than the travel.
          ease: EASE.out,
        },
      ),
    )
  }

  const figure = root.querySelector('[data-hero="portrait"]')
  if (figure) {
    targets.push(figure)
    // The portrait scales from slightly large rather than small: a figure growing
    // into place reads as a UI element appearing, while one settling back from a
    // push-in reads as a camera coming to rest.
    setStyles(figure, { opacity: 0, scale: 1.04 })
    running.push(animate(figure, { opacity: 1, scale: 1 }, { duration: DUR.d6, delay: ms(120), ease: EASE.out }))
  }

  const glow = root.querySelector('[data-hero="portrait-glow"]')
  if (glow) {
    targets.push(glow)
    setStyles(glow, { opacity: 0 })
    running.push(animate(glow, { opacity: 1 }, { duration: DUR.d6 * 1.45, delay: ms(240), ease: EASE.soft }))
  }

  /*
   * Teardown STOPS each animation, then clears the inline styles this wrote.
   *
   * The stop is the half that anime.js did for free through `scope.revert()`.
   * Without it, clearing the styles is pointless: a still-running animation owns
   * the element and writes its own value back on the very next frame, so the hero
   * would keep animating into a component that has already unmounted.
   *
   * Clearing rather than reversing is deliberate. Anything left behind, an
   * opacity, a transform, would be a value the stylesheet no longer controls, and
   * on a client-side navigation back to this page it would fight the fresh mount.
   */
  return () => {
    running.forEach((animation) => animation.stop())
    clearStyles(targets)
  }
}

/*
 * THE NAME SHIMMER IS GONE, AND ITS REMOVAL FIXED A RENDERING BUG AS WELL AS A
 * TASTE ONE.
 *
 * What stood here painted the name with `background-clip: text` and
 * `-webkit-text-fill-color: transparent`, then swept a champagne band across it.
 *
 * THE BUG: `background-clip: text` clips to the ELEMENT BOX, not to the glyphs.
 * The h1 is a block, 672px wide at 1440px viewport, while the name itself only
 * inks 467px of that. With `background-size: 220%` starting at `120% 0`, the
 * gradient's opaque region sat off past the right of the text, so the first ~200px
 * of glyphs were painted with the transparent tail. "Sanae Rakik" rendered as
 * "akik" for the 1.5s of the sweep, and permanently for anyone whose
 * `onComplete` never fired, a tab backgrounded during the delay, most obviously.
 *
 * THE TASTE: it was gradient text, on a person's name. A moving highlight is what
 * a logo does, not what a name does. The entrance already gives the name its
 * moment; it does not need to also glint.
 *
 * Deliberately not replaced with a "fixed" version. The correct fix would be
 * `background-clip` on an inline-block shrink-wrapped to the text, which still
 * leaves gradient text on the one string on this page that must never fail to
 * render.
 */

/*
 * THE ROLE ROTATION MOVED TO THE FRAMER LAYER.
 *
 * `rotateRoles()` lived here and is now components/motion/fm/role-cycle.tsx. It
 * was ~180 lines, and almost all of them existed to answer one question: how wide
 * is this box about to be. It measured each role by writing the text into the live
 * element and reading `scrollWidth`, cached the results in a Map, invalidated that
 * Map on resize, drove a separately-tracked width spring, and carried four
 * promise-rejection arms so that tearing down mid-crossfade did not log unhandled
 * rejections into the console on every navigation.
 *
 * `layout` projection answers that question by measuring the real box after React
 * has rendered the new text, so the measurement, the cache, the resize handler and
 * a forced layout per role are all simply gone.
 *
 * THE VISUAL CONTRACT DID NOT CHANGE. Same 2000ms hold, same first change at
 * HOLD + 600, same out-then-in crossfade on the same two curves, same `bounce: 0`
 * on the width so the edge never overshoots, that constraint comes from intake
 * section 3 and is restated at the new call site.
 *
 * WHY IT HAD TO BE DELETED RATHER THAN LEFT DORMANT: both versions write
 * `textContent` and `style.width` on the same element. Two systems writing one
 * property is the exact failure the ownership rule in
 * components/motion/fm/variants.ts exists to prevent, and a dormant copy is one
 * `mountHero` edit away from being live again.
 *
 * `[data-anime="role-lead"]` still exists in components/hero.tsx and is still
 * animated by `entrance()` below, but it is now the WRAPPER around the animated
 * line, not the line itself. The vanilla layer fades the wrapper in on load; the
 * Framer layer rotates the text inside it. Two elements, two effects, no shared
 * property.
 */

/*
 * THE PORTRAIT NO LONGER FOLLOWS THE POINTER.
 *
 * A `parallax()` here drifted the figure up to 10px against the cursor, with the
 * glow behind it displacing further to sell depth. It was small and it was
 * smooth, and it was still wrong for this page: the subject of the photograph is
 * a person, and tying her to the cursor makes her an element of the interface
 * rather than the person the page is about. Every movement then reads as the
 * site responding to the visitor, which is the opposite of the register intake
 * section 3 asks for ("رسمي · قيادي", and no "عناصر حركية زائدة").
 *
 * The entrance animation stays, that plays once, on arrival, and settles. What
 * is gone is the part that never settled.
 *
 * `portraitDrift` below is NOT that effect returning, and the difference is the
 * input. See the note on it.
 */

/*
 * THE PORTRAIT DRIFT MOVED TO THE FRAMER LAYER TOO.
 *
 * `portraitDrift()` scrubbed the figure 8px downward across the hero's exit. It is
 * now components/motion/fm/hero-camera.tsx, where those 8px survive as ONE TERM of
 * a larger move: the portrait recedes in Z, tilts its top edge away, trails
 * downward and dims as the hero leaves.
 *
 * ── THE ARGUMENT ABOVE STILL GOVERNS IT ────────────────────────────────────────
 *
 * The note above this one removed a parallax that tracked the CURSOR, and the
 * objection was never that the figure moved, it is that tying a photograph of a
 * person to the pointer makes her an element of the interface. Scroll carries none
 * of that: it is the reader leaving, the frame settling as they go is how a camera
 * behaves rather than how a widget behaves, and it ENDS once the hero is off
 * screen. That reasoning transferred with the code and is restated at the new
 * call site, along with the ceiling on every number.
 *
 * ── WHY IT COULD NOT STAY HERE ALONGSIDE THE NEW ONE ───────────────────────────
 *
 * `entrance()` above also writes this element, `opacity` and `scale`, on load.
 * The camera writes `opacity`, `scale`, `y`, `z` and `rotateX`. Three writers on
 * one node, two of them on the same two properties.
 *
 * The fix is in the markup rather than here: components/hero.tsx now nests a
 * second element inside `[data-hero="portrait"]`, so the entrance owns the outer
 * node and the camera owns the inner one. One effect per element, which is the
 * rule components/motion/sections.ts:371-383 states and
 * components/motion/fm/variants.ts carries into the Framer layer.
 *
 * `DRIFT` and the `scroll` import went with it. Nothing in this file observes the
 * scroll position any more, which is what lets the docblock at the top say so
 * without qualification.
 */
