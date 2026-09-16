import { animate, stagger } from "motion"
import { DUR, EASE, ms } from "./tokens"
import { clearStyles, toArray, type Handle } from "./dom"
import {
  linear,
  linkProgress,
  inViewRepeat,
  edgeOf,
  BAND_OFFSET,
  READ_OFFSET,
  type Edge,
  type ScrollHandle,
} from "./scroll"

/**
 * The section entrance layer, and the scroll-linked effects that go with it.
 *
 * ── THIS IS NOT THE SCROLL MOTION THAT WAS REMOVED ─────────────────────────────
 *
 * A previous pass deleted a scroll layer from this codebase, and the reasons are
 * still written in components/motion/interactions.ts: those effects responded to
 * the pointer rather than the reader, they decorated content nobody could click,
 * and lift-toward-cursor plus dim-the-neighbours are stock gestures that made the
 * page read as generated.
 *
 * None of that describes what is here. Every entrance below plays on arrival and
 * settles; it replays if the reader leaves the band and comes back, arriving from
 * whichever edge they returned by. The three scrubbed
 * effects are tied to the reader's own scroll position and carry information about
 * it: how far through the roles ledger they have read, how far into a band they
 * are, and the hero's depth as it leaves. Nothing tracks a cursor. Nothing moves
 * while the page is still.
 *
 * ── THE CLIENT ASKED FOR LESS MOTION, AND THAT IS ON THE RECORD ────────────────
 *
 * data/exclusions.json logs intake section 3: "تجنّب … العناصر الحركية الزائدة",
 * avoid excessive motion elements, against a requested character of "رسمي · قيادي".
 * That entry is now marked `override: true`, scoped to the motion clause only, with
 * a note naming who directed it and recording that it was NOT a written client
 * override. It is to be put to her at sign-off. Read that entry before adding
 * anything to this file.
 *
 * ── THE SAFETY MODEL, IN THREE LAYERS ──────────────────────────────────────────
 *
 * Content on this site must never depend on JavaScript to be visible. That is not a
 * preference; it is a bug this repo has already shipped once, recorded in the
 * `.reveal` note at the end of styles/globals.css.
 *
 *   LAYER 1, THE FROM-STATE IS WRITTEN BY THE CODE THAT ANIMATES IT AWAY. Markup
 *     ships complete and visible from the server. The from-state, opacity:0, or a
 *     collapsed clip-path, is written only at the instant an animation is queued
 *     to remove it. A bundle that fails, a chunk that 404s, a scope that never
 *     mounts, each leaves the page exactly as the server rendered it, because the
 *     hiding half never ran.
 *
 *     IT IS WRITTEN AS A ZERO-DURATION `animate()`, NOT BY `setStyles`. The two
 *     represent `transform` incompatibly and mixing them strands a replayed band
 *     invisible; `rearm` in `entrance()` below carries the full account.
 *
 *   LAYER 2, THE DEADLINE. A from-state IS written the moment an observer
 *     registers, and a scroll that never happens leaves it written. So every
 *     entrance arms a timer: if the observer has not fired within
 *     ENTRANCE_DEADLINE, the animation is run and immediately completed.
 *
 *   LAYER 3, TEARDOWN RESTORES, NEVER REVERTS. `clearStyles` drops the inline
 *     styles and hands control back to the stylesheet, where every animated
 *     element's declared state is its VISIBLE one. Reverting the animation would
 *     replay it backwards into the from-state and leave content hidden on unmount,
 *     the worst possible teardown for a client-side navigation.
 *
 * A fourth floor lives in CSS: `[data-anime] { opacity: 1 }` unconditionally, plus
 * the reduced-motion block that forces clip-path and the scroll rails to finished
 * states.
 */

/**
 * How long an entrance may wait for its trigger before it is simply completed.
 *
 * 2000ms is chosen from both ends: long enough that a normal scroll always wins the
 * race, an entrance firing from the deadline rather than the observer is a bug,
 * not a feature, and short enough that nothing is ever invisible for a length of
 * time a reader would notice or attribute to a broken page.
 */
const ENTRANCE_DEADLINE = 2000

export type RecipeName =
  | "bandHeading"
  | "markWall"
  | "ledgerRows"
  | "aboutSpread"
  | "panelGrid"
  | "proseArrival"

type Mounted = { cleanup: () => void }

const RISE = 12

/** Elements under `root` carrying a given `data-anime` hook. */
function hooks(root: Element, name: string): HTMLElement[] {
  return toArray(root.querySelectorAll(`[data-anime="${name}"]`))
}

/**
 * Per-element delays on a DIAGONAL WAVEFRONT, in seconds.
 *
 * ── WHY NOT `stagger()` ────────────────────────────────────────────────────────
 *
 * Motion's `stagger()` walks the target list in SOURCE ORDER, which for a grid
 * means the wave travels along rows: three cards light left-to-right, then the
 * next three, then the next. A reader sees a table being filled in, one row at a
 * time, which is the "template animating itself" reading the `.panel-wipe` note in
 * styles/globals.css objects to.
 *
 * A wavefront travels by POSITION instead. Delay is derived from each element's
 * distance along the diagonal, `x + y`, measured from the grid's leading corner,
 * so the arrival sweeps across the block as one front regardless of how many
 * columns the breakpoint happens to produce. The same code gives a 4-column
 * desktop grid and a 1-column phone layout the correct wave with no branch,
 * because on one column `x` is constant and the expression degenerates to `y`.
 *
 * ── THE INLINE AXIS IS MEASURED FROM THE READING EDGE ─────────────────────────
 *
 * `getBoundingClientRect()` returns PHYSICAL coordinates. In Arabic the grid's
 * first cell sits at the physical right, so a raw `x` would start the wave at the
 * last card and travel backwards against the reading direction, the precise
 * failure ./interactions.ts:90-136 records for the form underline, in a new place.
 *
 * `dir` is read from the DOM rather than threaded down as a prop, for the reason
 * ./fm/use-direction.ts gives: app/layout.tsx has already put it there, and a
 * second copy is a second thing to keep in sync.
 *
 * ── ONE FORCED LAYOUT, NOT ONE PER ELEMENT ────────────────────────────────────
 *
 * Every rect is read in a single pass before any style is written. Interleaving
 * reads and writes is what turns an entrance into a layout thrash, the same
 * hazard ./tokens.ts documents for `getComputedStyle` in the interaction hot path.
 * This runs once per section mount, not per frame.
 */
function wavefront(targets: HTMLElement[], step: number): number[] {
  if (!targets.length) return []

  const rtl = typeof document !== "undefined" && document.dir === "rtl"

  const rects = targets.map((el) => el.getBoundingClientRect())

  /*
   * The origin is the grid's LEADING corner: top, and whichever inline edge the
   * reader starts from. Derived from the measured rects rather than assumed, so a
   * grid that is centred or offset in the page still waves from its own corner
   * rather than from the viewport's.
   */
  const originY = Math.min(...rects.map((r) => r.top))
  const originX = rtl
    ? Math.max(...rects.map((r) => r.right))
    : Math.min(...rects.map((r) => r.left))

  const distances = rects.map((r) => {
    const dx = Math.abs((rtl ? r.right : r.left) - originX)
    const dy = r.top - originY
    /*
     * The inline axis is weighted at 0.6 rather than 1. A grid is wider than it is
     * tall, so an unweighted sum makes the wave almost horizontal and the last
     * column lands absurdly late, 4 columns of 320px would be 768px of travel
     * against maybe 200px of row height. Flattening the inline term tilts the
     * front to roughly 30°, which reads as a diagonal rather than as a row sweep.
     */
    return dx * 0.6 + dy
  })

  const span = Math.max(...distances) || 1

  /*
   * Normalised to the grid's own diagonal, so the TOTAL entrance takes the same
   * wall-clock time whether there are three cards or twelve. `step` is therefore
   * the duration of the whole wave, not a per-element increment, which is what
   * keeps an eight-card wall from taking twice as long as a four-card one.
   */
  return distances.map((d) => (d / span) * step)
}

/**
 * Wire one entrance: hide, wait for arrival, reveal, with the deadline armed.
 *
 * Returns a cleanup that clears the timer, stops the observer, stops the animation
 * and restores the elements, in that order.
 */
function entrance(
  root: Element,
  targets: Element[],
  from: Record<string, string | number>,
  play: () => Handle,
): Mounted {
  if (!targets.length) return { cleanup: () => {} }

  /*
   * ⚠️ RE-ARMING GOES THROUGH MOTION, NOT THROUGH `setStyles`, AND THE DIFFERENCE
   *    IS A BAND THAT NEVER COMES BACK. Measured on /en, not theorised.
   *
   * The two write the same CSS property in INCOMPATIBLE REPRESENTATIONS:
   *
   *   setStyles   composes and assigns a string, `transform: translateY(12px)`.
   *   animate()   drives Motion's INDEPENDENT transform properties, tracked in its
   *               own internal state and serialised by it.
   *
   * At first mount the mismatch is invisible, because Motion holds no prior state
   * for the element and simply takes the property over. ON A REPLAY IT IS FATAL.
   * `exit()` writing the raw string leaves Motion still believing the element
   * finished at `translateY(0)` with `opacity: 1`; the next entrance therefore
   * interpolates 0 → 0, writes nothing at all, and the `opacity: 0` sitting in the
   * inline style is never animated away.
   *
   * The band is then INVISIBLE, permanently, not merely un-animated. That is the
   * precise failure the three-layer safety model at the top of this file exists to
   * prevent, and the replay logic reintroduced it: the deadline does not rescue it
   * either, because the deadline's own `.complete()` completes the same no-op
   * animation.
   *
   * Writing the from-state as a zero-duration ANIMATION keeps the two in agreement.
   * Motion performs the write and records the values as the element's current
   * state, so the entrance that follows interpolates from exactly where the element
   * actually is. `duration: 0` makes it a jump rather than a move, animating INTO
   * the hidden state would show the content retreating before it arrives, which is
   * the backwards-entrance failure this file warns about elsewhere.
   */
  /*
   * ── STATIC PROPERTIES ARE ASSIGNED, NOT ANIMATED ─────────────────────────────
   *
   * `mirrorFrom`'s own note already states the fact this depends on:
   * "transformOrigin, willChange are not animated values at all". They travel in
   * the same `from` object as the animated properties purely because that object
   * is also the from-STATE, and they were being passed straight into `animate()`
   * with everything else.
   *
   * Motion treats every key it is handed as a value to interpolate. For
   * `willChange` that is harmless, the strings are swapped whole. For
   * `transformOrigin` it is not: Motion reads the element's current computed
   * origin, which the browser resolves to a PIXEL PAIR ("448px 100.3px"), and
   * tries to interpolate that toward the keyword pair "center top". Keywords are
   * not interpolatable, so it logs
   *
   *   You are trying to animate transformOrigin from "448px 100.3px" to
   *   "center top". "center top" is not an animatable value.
   *
   * on every mount of the `ledgerRows` recipe, i.e. on every load of the homepage.
   *
   * Splitting them here fixes it at the one chokepoint every recipe passes through,
   * rather than in the six from-objects that happen to carry such a key today.
   * They are written straight to `el.style` rather than through `setStyles`,
   * because `setStyles` composes `transform` as a string and the docblock below
   * records what mixing that with Motion's transform state costs. Neither property
   * is a transform, so neither goes near that path.
   */
  const STATIC_PROPS = new Set(["transformOrigin", "willChange"])

  const rearm = (values: Record<string, string | number>) => {
    const animated: Record<string, string | number> = {}

    for (const [key, value] of Object.entries(values)) {
      if (STATIC_PROPS.has(key)) {
        for (const el of targets) {
          ;(el as HTMLElement).style[key as "transformOrigin" | "willChange"] = String(value)
        }
        continue
      }
      animated[key] = value
    }

    animate(targets as never, animated as never, { duration: 0 } as never)
  }

  rearm(mirrorFrom(from, edgeOf(root)))

  let animation: Handle | undefined
  let settled = false

  /*
   * Arrive. Any in-flight animation is stopped first: a reader who reverses
   * mid-entrance would otherwise have two animations writing the same properties,
   * and whichever was queued last would win per frame.
   */
  const enter = () => {
    animation?.stop()
    animation = play()
    settled = true
  }

  /*
   * Leave, re-arm for the next arrival by writing the from-state back.
   *
   * MIRRORED TO THE EDGE THE READER LEFT BY, which is the whole point of the
   * direction plumbing. A band that has gone out through the TOP will be re-entered
   * from above, so its next entrance must come from above too: the block-axis terms
   * are negated and it descends into place instead of rising. Leave them unmirrored
   * and a reader scrolling up watches every band rise from below, content
   * travelling the opposite way to the reader, which reads as the page fighting them.
   *
   * The deadline is re-armed with it. Re-arming writes a hiding from-state exactly
   * as the first mount did, so it needs exactly the same guarantee that the state is
   * removed if the observer never fires again, a re-arm that stranded a band hidden
   * would be the same bug as the original, only harder to see.
   */
  const exit = (edge: Edge) => {
    if (!settled) return
    animation?.stop()
    animation = undefined
    settled = false
    rearm(mirrorFrom(from, edge))
    arm()
  }

  let timer: ReturnType<typeof setTimeout> | undefined

  const arm = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (settled) return
      enter()
      // `.complete()` is what makes the deadline a guarantee rather than just a
      // second trigger: it jumps to the end state, so the content is correct on the
      // next frame even if the entrance had already started.
      animation?.complete?.()
    }, ENTRANCE_DEADLINE)
  }

  arm()

  const stopObserver = inViewRepeat(root, enter, exit)

  return {
    cleanup: () => {
      clearTimeout(timer)
      stopObserver()
      animation?.stop()
      /*
       * `transform-origin` and `will-change` are appended to the default list
       * because `rearm` above now writes them as inline styles rather than handing
       * them to `animate()`. Teardown removes what this module wrote, and leaving
       * them off would strand a permanent `will-change` on every animated element,
       * which is a compositor layer held for the life of the page, exactly the cost
       * the `.section-skew` and `.stack-item` notes in styles/globals.css decline.
       */
      clearStyles(targets, [
        "opacity",
        "transform",
        "clip-path",
        "height",
        "overflow",
        "transform-origin",
        "will-change",
      ])
    },
  }
}

/**
 * The block-axis terms of a from-state, negated when the reader is coming from
 * above.
 *
 * ── WHICH PROPERTIES REVERSE, AND WHICH MUST NOT ──────────────────────────────
 *
 * `translateY` and `rotateX` are the two directional terms in this file's recipes:
 * both describe a position on the BLOCK axis relative to where the element ends
 * up, so both are meaningful to flip. A card that hinges down from -8° on the way
 * in should hinge UP from +8° when it is re-met from the other side.
 *
 * Everything else is deliberately left alone, and that is not an oversight:
 *
 *   opacity, filter, letterSpacing, scale, translateZ  have no direction. There is
 *     no "blurred from above". Negating a blur radius or a scale produces an
 *     invalid or inverted value, not a mirrored gesture.
 *   clipPath  IS directional, `inset(0 0 100% 0)` uncovers downward, but it is
 *     also the one property here whose reversal changes what the gesture MEANS.
 *     `.panel-wipe` in styles/globals.css argues a card is uncovered in place from
 *     its leading edge; uncovering it upward instead would give the same grid two
 *     different physical metaphors depending on approach direction. It stays put.
 *   transformOrigin, willChange  are not animated values at all.
 */
function mirrorFrom(
  from: Record<string, string | number>,
  edge: Edge,
): Record<string, string | number> {
  if (edge !== "above") return from

  const out = { ...from }
  for (const key of ["translateY", "rotateX"] as const) {
    const v = out[key]
    if (typeof v === "number") out[key] = -v
  }
  return out
}

/**
 * Add a class to each target as the section arrives, staggered.
 *
 * ── WHY A CLASS AND NOT AN `animate()` CALL ────────────────────────────────────
 *
 * Everything else in this file animates an element's own inline style. Two effects
 * in the About block cannot be reached that way, and for different reasons:
 *
 *   - THE LEDGER RULE IS A PSEUDO-ELEMENT. `.about-ledger-row::before` has no
 *     node, so `querySelectorAll` cannot return it and `animate()` cannot take it
 *     as a target. A class on the real parent is the only handle CSS gives us.
 *   - THE TEXT SWEEP IS A `background-position`. It could in principle be animated
 *     inline, but it must ALSO respond to `:hover` and `:focus-visible` in the
 *     ledger's case, and an inline style written by JS outranks both, so the
 *     pointer states would silently stop working. Leaving the property in the
 *     stylesheet keeps one owner for it.
 *
 * So this schedules class writes rather than animations, and the transition that
 * plays is declared in styles/globals.css beside the property it moves. That also
 * means the reduced-motion floor for both effects is a plain CSS override, which
 * cannot be raced by a mount that happens before the media query resolves.
 *
 * THE SAFETY MODEL IS INVERTED HERE, AND IT IS THE SAFER DIRECTION. Every other
 * entrance in this file writes a hiding from-state and needs a deadline to
 * guarantee it is removed. This one writes NOTHING until it fires: the from-state
 * is the stylesheet's declared state, and the class only ever adds the finished
 * one. A scope that never mounts, a bundle that 404s, an observer that never
 * fires, each leaves undecorated but fully legible content, so there is no
 * deadline to arm and nothing to restore beyond removing the class.
 */
function litClass(
  root: Element,
  targets: HTMLElement[],
  className: string,
  step = 70,
  startDelay = 0,
): Mounted {
  if (!targets.length) return { cleanup: () => {} }

  let timers: ReturnType<typeof setTimeout>[] = []

  const clear = () => {
    timers.forEach(clearTimeout)
    timers = []
  }

  /*
   * The sweep re-arms with everything else. Pending timers are cleared on the way
   * out before the class is removed, a stagger still running when the reader
   * leaves would otherwise re-add the class to the rows it had not reached yet,
   * seconds after the band went off screen, and the next arrival would find them
   * already lit and sweep only the remainder.
   *
   * THE ORDER REVERSES WHEN RE-ENTERED FROM ABOVE. The stagger is a wave down the
   * ledger; met from the other side it runs up it, for the same reason `mirrorFrom`
   * negates a translate. `startDelay` is not mirrored, it exists to clear the row
   * entrance that precedes this, which takes the same time from either direction.
   */
  const stopObserver = inViewRepeat(
    root,
    (edge) => {
      clear()
      const order = edge === "above" ? [...targets].reverse() : targets
      order.forEach((el, i) => {
        timers.push(setTimeout(() => el.classList.add(className), startDelay + i * step))
      })
    },
    () => {
      clear()
      targets.forEach((el) => el.classList.remove(className))
    },
  )

  return {
    cleanup: () => {
      clear()
      stopObserver()
      targets.forEach((el) => el.classList.remove(className))
    },
  }
}

/**
 * The six entrances. Each targets the `data-anime` hooks that were left in the
 * markup as re-entry points when the previous scroll layer was removed.
 *
 * WHAT NONE OF THEM DO: split text. `splitText` ships in this package and must not
 * be imported, organisation names and the subject's own name are required to
 * render as single intact text nodes (see data/exclusions.json and the note in
 * components/section-header.tsx). Every recipe here animates whole ELEMENTS.
 */
/**
 * The hairline under each engagement row, drawn rather than faded.
 *
 * ── WHY THIS IS NOT PART OF THE `entrance()` ABOVE ────────────────────────────
 *
 * `entrance` animates the ELEMENTS it is given. The rule is a `::after` on each
 * row, and a pseudo-element cannot be handed to Motion, there is no node to
 * target. So the transition lives in the stylesheet (`.engagement-rule`) and this
 * function does the only thing JavaScript can do to a pseudo-element: flip an
 * attribute on its host and let CSS run.
 *
 * ── THE ATTRIBUTE IS WHY A FAILED BUNDLE DOES NOT LEAVE THE SECTION UNRULED ───
 *
 * `[data-wipe="armed"]` is the ONLY selector that sets `scaleX(0)`, and it is
 * written here, at mount. Markup that never meets this code has no `data-wipe` at
 * all and paints every rule at its resting scale. That is the same ordering
 * hero.ts states as the floor: the from-state is written by the code that
 * animates it away, never by the stylesheet alone.
 *
 * ── THE DELAY IS A CUSTOM PROPERTY, NOT A `setTimeout` PER ROW ────────────────
 *
 * Four timers that have to be cleared on exit is four ways to leak. The stagger
 * is handed to CSS as `--engagement-rule-delay` and the browser owns the
 * scheduling, so teardown is one attribute removal and nothing is left pending.
 *
 * It re-arms on `exit` for the same reason the row entrance does, a reader who
 * scrolls a band out and back gets it drawn again rather than finding it already
 * finished.
 */
function ruleWipe(root: Element, rows: HTMLElement[]): Mounted {
  const ruled = rows.filter((row) => row.classList.contains("engagement-rule"))
  if (!ruled.length) return { cleanup: () => {} }

  const arm = () => {
    ruled.forEach((row, i) => {
      row.style.setProperty("--engagement-rule-delay", `${140 + i * 70}ms`)
      row.setAttribute("data-wipe", "armed")
    })
  }

  const draw = () => {
    // Two frames, not one. The `armed` state must be COMMITTED before `drawn`
    // replaces it, or the browser coalesces both into a single style resolution,
    // sees no change in `scaleX`, and skips the transition entirely, the rule
    // simply exists, already drawn.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ruled.forEach((row) => row.setAttribute("data-wipe", "drawn"))
      })
    })
  }

  arm()
  draw()

  const stopObserver = inViewRepeat(
    root,
    draw,
    () => {
      arm()
      draw()
    },
  )

  return {
    cleanup: () => {
      stopObserver()
      ruled.forEach((row) => {
        // Removed, not set to "armed": an undrawn rule is the one end state that
        // loses the section its dividers, and teardown can land mid-wipe.
        row.removeAttribute("data-wipe")
        row.style.removeProperty("--engagement-rule-delay")
      })
    },
  }
}

const RECIPES: Record<RecipeName, (root: Element) => Mounted[]> = {
  /**
   * A heading arrives, then the lede follows.
   *
   * There was a third element here: a decorative rule between the two, which
   * scaled out from its leading edge. The rule is gone from the markup (see
   * components/section-header.tsx), so the branch that drew it is gone with it.
   */
  bandHeading(root) {
    /*
     * There was a fourth element here: the section ordinal, faded and lifted into
     * place ahead of the heading. The ordinals are gone from the markup (see
     * components/section-header.tsx), so the branch that animated them is gone
     * with them rather than being left to filter an empty list every mount.
     */
    const heading = hooks(root, "heading")
    const lede = hooks(root, "lede")

    const out: Mounted[] = []

    if (heading.length) {
      /*
       * ── KERNING EXPANSION: THE ONE LETTER-LEVEL EFFECT THAT IS SAFE HERE ──────
       *
       * The heading settles from 0.12em of extra tracking to its natural spacing.
       * Letters appear to draw together into a word rather than the word sliding
       * into place, the same "printing rather than moving" reading the
       * `.panel-wipe` note argues for, applied to type.
       *
       * ── WHY THIS IS NOT A `splitText` VIOLATION ──────────────────────────────
       *
       * It is the critical distinction and worth stating plainly. The ban stated
       * in four files, and enforced by scripts/check-publish-gate.mjs, is on
       * SPLITTING a text node into per-character elements, because organisation
       * names and the subject's own name must render as single intact nodes.
       *
       * `letter-spacing` is a CSS property on the UNSPLIT element. The text node
       * is never touched, never wrapped, never divided. A screen reader sees one
       * string throughout, copy-paste yields the real text, and the publish gate's
       * pattern (`splitText`) is not tripped because nothing here splits.
       *
       * ── AND WHY IT IS SAFE IN ARABIC, WHICH PER-GLYPH EFFECTS ARE NOT ────────
       *
       * Arabic is cursive: letters join, and their shapes depend on their
       * neighbours. Splitting a word into per-character spans breaks the joins and
       * renders isolated letterforms, which is a second, independent reason the
       * split ban exists. `letter-spacing` does NOT break joins; the shaper still
       * sees one run and still applies contextual forms. Browsers add the space
       * between shaped glyphs after shaping.
       *
       * It IS visually stronger in Arabic than in Latin, because the joins stretch
       * rather than the gaps widening. 0.12em was chosen against the Arabic
       * rendering rather than the English one, where it could have gone further.
       *
       * ── THE REFLOW COST, WHICH IS REAL AND BOUNDED ───────────────────────────
       *
       * `letter-spacing` is a LAYOUT property: every frame re-measures the text
       * and can re-wrap the line. That is the opposite of the compositor-only
       * discipline ../scroll.ts holds for scrubbed effects, and it would be
       * indefensible on a scroll-linked animation.
       *
       * It is defensible here because it is bounded: one element, one d5, on
       * arrival, never scrubbed. `translateY` was DROPPED from this entrance in
       * the same change, the heading now expands rather than expanding AND
       * rising, because two simultaneous gestures on one element is the
       * "two unrelated things happening" reading this file objects to elsewhere.
       */
      out.push(
        entrance(
          root,
          heading,
          { opacity: 0, letterSpacing: "0.12em", willChange: "letter-spacing, opacity" },
          () =>
            animate(
              heading,
              { opacity: 1, letterSpacing: "0em" },
              { duration: DUR.d6, delay: ms(60), ease: EASE.rule },
            ) as Handle,
        ),
      )
    }

    if (lede.length) {
      /*
       * The lede resolves out of blur while the heading is still settling. It is
       * the quieter half of the pair and stays a translate, a second kerning
       * animation on the paragraph below the heading would be the same gesture
       * twice, and on body copy the reflow cost buys much less.
       */
      out.push(
        entrance(
          root,
          lede,
          { opacity: 0, translateY: 8, filter: "blur(6px)", willChange: "filter, opacity, transform" },
          () =>
            animate(
              lede,
              { opacity: 1, translateY: 0, filter: "blur(0px)" },
              { duration: DUR.d5, delay: ms(280), ease: EASE.out },
            ) as Handle,
        ),
      )
    }

    return out
  },

  /**
   * The expertise wall: the panels fade up in sequence.
   *
   * There were two ornaments here before, each with its own entrance. First a
   * column of figures that lifted and faded over a count-up spinning the digits
   * from 00 to their value, an rAF loop per element, a snapshot of every
   * server-rendered string, and a teardown that had to restore them all in case a
   * cleanup landed mid-count and stranded a row reading "03". Those became short
   * gold gutter strokes that drew via `scaleX`, which was far cheaper.
   *
   * Both are now gone: the strokes were decoration standing in for a bullet. What
   * is left is the panels themselves, which are the content, so this recipe
   * animates only them.
   */
  markWall(root) {
    const rows = hooks(root, "panel")

    const out: Mounted[] = []

    if (rows.length) {
      /*
       * THE WALL WAVES DIAGONALLY TOO, and shares `panelGrid`'s language on
       * purpose, /expertise renders `markWall` above `panelGrid` on the same
       * page, and two lists arriving by two different rules reads as two
       * components that happen to sit together rather than as one page.
       *
       * The depth term is HALF `panelGrid`'s (20px against 40px) and there is no
       * blur at all. These are text rows, not glass panels: blurred type at 10px
       * is unreadable rather than unresolved, and the raster cost falls on a text
       * layer that would otherwise never re-rasterise.
       */
      const delays = wavefront(rows, ms(380))

      out.push(
        entrance(
          root,
          rows,
          { opacity: 0, translateZ: -20, willChange: "opacity, transform" },
          () =>
            animate(
              rows,
              { opacity: 1, translateZ: 0 },
              {
                duration: DUR.d4,
                delay: (i: number) => ms(90) + (delays[i] ?? 0),
                ease: EASE.soft,
              },
            ) as Handle,
        ),
      )
    }

    return out
  },

  /**
   * The roles ledger: each card uncovered in place by a block-axis wipe.
   *
   * No translate anywhere, see the `.panel-wipe` note in styles/globals.css for
   * why a moving box is the wrong gesture for a grid.
   */
  ledgerRows(root) {
    const rows = hooks(root, "rail-item")
    if (!rows.length) return []

    const panels = rows
      .map((r) => r.querySelector<HTMLElement>(".panel-wipe"))
      .filter((p): p is HTMLElement => p !== null)
    const targets = panels.length ? panels : rows

    return [
      /*
       * THE ROLES CARDS ARRIVE OUT OF DEPTH, ROTATING FLAT.
       *
       * `rotateX(-8deg)` about the card's TOP edge, so each card hinges down into
       * the page plane like a page being laid flat, with the perspective supplied
       * by `.ledger-rail` in styles/globals.css, not by this file.
       *
       * ── IT IS A ROTATION, NOT A LIFT, FOR THE REASON ./fm/expertise-card.tsx
       *    ALREADY ARGUES ──
       *
       * That file answers the `magneticCards` removal note by choosing rotation
       * over lift: "a box that grows toward you reads as a button offering to be
       * pressed. A plane that rotates in place reads as a surface catching light."
       * These roles cards ARE links, so a button reading would be less wrong here
       * than it was there, but the two lists would then arrive by two different
       * physical metaphors on a site whose whole argument is that it is one hand.
       *
       * ── THE ANGLE IS 8°, AND THE CEILING IS LEGIBILITY ──────────────────────
       *
       * Text on a plane rotated past about 12° is text whose baseline the eye can
       * see is wrong, and the serif's thin strokes alias badly across the
       * foreshortening. 8° is felt as depth without being nameable as a rotation.
       *
       * `transformOrigin` is "center top", block-axis only, nothing to mirror for
       * RTL. ./fm/use-direction.ts lists `rotateX` among the properties that are
       * direction-safe by construction.
       */
      entrance(
        root,
        targets,
        {
          clipPath: "inset(0 0 100% 0)",
          opacity: 0,
          rotateX: -8,
          translateZ: -30,
          transformOrigin: "center top",
          willChange: "clip-path, transform, opacity",
        },
        () =>
          animate(
            targets,
            { clipPath: "inset(0% 0% 0% 0%)", opacity: 1, rotateX: 0, translateZ: 0 },
            { duration: DUR.d5, delay: stagger(ms(80)), ease: EASE.out },
          ) as Handle,
      ),
    ]
  },

  /**
   * About: the bio column, the fact rows, and the portrait settling back from a
   * slight push-in, the same camera-coming-to-rest language ./hero.ts argues for,
   * so the two portraits on the site behave alike.
   */
  aboutSpread(root) {
    const bio = hooks(root, "bio")
    const rows = hooks(root, "row")
    const figure = hooks(root, "figure")

    const out: Mounted[] = []

    if (bio.length) {
      out.push(
        entrance(root, bio, { opacity: 0, translateY: RISE }, () =>
          animate(bio, { opacity: 1, translateY: 0 }, { duration: DUR.d5, ease: EASE.out }) as Handle,
        ),
      )
    }

    if (rows.length) {
      out.push(
        entrance(root, rows, { opacity: 0, translateY: 8 }, () =>
          animate(
            rows,
            { opacity: 1, translateY: 0 },
            { duration: DUR.d4, delay: stagger(ms(60), { startDelay: ms(140) }), ease: EASE.out },
          ) as Handle,
        ),
      )

      out.push(ruleWipe(root, rows))
    }

    if (figure.length) {
      out.push(
        entrance(root, figure, { opacity: 0, scale: 1.03 }, () =>
          animate(figure, { opacity: 1, scale: 1 }, { duration: DUR.d6, ease: EASE.out }) as Handle,
        ),
      )
    }

    /*
     * ── THE CSS-DRIVEN SWEEP, LAST AND DELIBERATELY BEHIND THE REST ────────────
     *
     * It runs on the fact ledger and starts AFTER the rows themselves have
     * arrived. The ordering is the point: the row entrance above fades each cell
     * up over d4 on a 60ms stagger from a 140ms start, so the last of five lands
     * around 140 + 4*60 = 380ms. Decorating a cell that is still fading in reads
     * as two unrelated things happening to the same element, so this begins at
     * 600ms, clear of it, and then runs on its own slower stagger.
     *
     * THE GOLD LEDGER EDGE IS GONE. It was a gradient hairline drawn across each
     * row's top border on entrance and on hover; the rows keep their plain
     * `border-block-start` and nothing is drawn over it. The `is-lit` pass that
     * fed it went with it, see styles/globals.css at `.about-ledger-row`.
     *
     * It does not query `root` for its own hook. It selects WITHIN the ledger
     * rows that already carry `data-anime="row"`, so a section using this recipe
     * without a ledger, the home page's About band and /about both have one, but
     * nothing forces that, simply finds nothing and registers nothing.
     */
    const ledgerRows = rows.filter((r) => r.classList.contains("about-ledger-row"))

    if (ledgerRows.length) {
      const swept = ledgerRows
        .map((r) => r.querySelector<HTMLElement>(".text-sweep"))
        .filter((el): el is HTMLElement => el !== null)

      out.push(litClass(root, swept, "is-swept", 90, 600))
    }

    return out
  },

  /**
   * A grid of panels, uncovered in place on a DIAGONAL WAVEFRONT, arriving out of
   * depth and out of focus.
   *
   * ── THREE PROPERTIES, AND EACH ONE EARNS ITS FRAME COST ───────────────────────
   *
   *   clipPath   the uncover. Unchanged from the original recipe and still the
   *              primary gesture, see `.panel-wipe` in styles/globals.css for why
   *              a card is uncovered in place rather than slid into position.
   *   filter     `blur(10px)` → `blur(0)`. This is the "rack focus" arrival: the
   *              card resolves rather than appears. It is the single most
   *              expensive property here (it forces a raster pass per frame per
   *              card) and it is why the blur radius is 10px and not 24, see the
   *              budget note below.
   *   translateZ depth. 40px of push-back with the perspective on the grid
   *              container, so cards arrive THROUGH the page rather than up it.
   *              Compositor-only and effectively free beside the blur.
   *
   * NO OPACITY TERM, DELIBERATELY. A blurred element at 40px of depth is already
   * visually absent; adding a fade would be a fourth property doing the third's
   * job, and `entrance()` writes a from-state that must be removed by a deadline,
   * every property in that from-state is one more thing left written if the
   * teardown is ever got wrong. The clip already carries the reveal.
   *
   * ── THE BLUR BUDGET, MEASURED ─────────────────────────────────────────────────
   *
   * `filter: blur()` is not compositor-only: it re-rasterises the element every
   * frame it changes. On the /expertise wall that is eight glass cards, each
   * already carrying `backdrop-filter: blur(14px)` from `.glass-card`, so a naive
   * blur entrance stacks two full-surface raster passes per card per frame.
   *
   * Three things keep it inside budget, and all three are load-bearing:
   *   1. 10px, not 24. Raster cost scales with radius; 10px resolves visibly and
   *      costs roughly a fifth of what a fashionable 24px would.
   *   2. `willChange` is set in the from-state and CLEARED by `clearStyles` in the
   *      teardown. A permanent `will-change: filter` on eight cards holds eight
   *      layers alive for the life of the page, which is the classic way this
   *      effect turns into a memory regression.
   *   3. It runs ONCE, on arrival, over d4. It is not scrubbed. A scroll-linked
   *      blur on this many glass cards is the thing that would actually drop
   *      frames, and it is not what this is.
   *
   * ── REDUCED MOTION IS NOT HANDLED HERE ────────────────────────────────────────
   *
   * `mountSection` is never called when the visitor has asked for less motion,
   * ./section-scope.tsx owns that check, so there is no guard in this file. That
   * mirrors ./hero.ts exactly and is stated at `mountSection` below.
   */
  panelGrid(root) {
    const panels = hooks(root, "panel")
    if (!panels.length) return []

    const delays = wavefront(panels, ms(420))

    return [
      entrance(
        root,
        panels,
        {
          clipPath: "inset(0 0 100% 0)",
          opacity: 0,
          filter: "blur(10px)",
          translateZ: -40,
          willChange: "filter, clip-path, transform",
        },
        () =>
          animate(
            panels,
            {
              clipPath: "inset(0% 0% 0% 0%)",
              opacity: 1,
              filter: "blur(0px)",
              translateZ: 0,
            },
            {
              duration: DUR.d4,
              /*
               * A function delay rather than `stagger()`: the wavefront is
               * positional, so each element's delay is looked up by index from the
               * measured pass above. Motion calls this per target with the index
               * it is animating, which is the same index `wavefront` returned.
               */
              delay: (i: number) => delays[i] ?? 0,
              ease: EASE.out,
            },
          ) as Handle,
      ),
    ]
  },

  /**
   * Prose, rows and the form: the quietest entrance, for the reading surfaces.
   *
   * ── THIS ONE IS DELIBERATELY NOT UPGRADED, AND THAT IS THE SYSTEM WORKING ────
   *
   * Every other recipe in this file gained depth, blur or a wavefront. This one
   * kept its 8px translate and its plain stagger, because the surfaces it runs on
   * are the ones a visitor came to READ: the biography, the governance prose, the
   * legal pages, the contact form, the footer.
   *
   * A blur entrance on a paragraph delays legibility by exactly as long as the
   * animation lasts. On a card that is a flourish; on the text someone is trying
   * to read it is an obstruction, and on the CONTACT FORM it is worse than that,
   * `filter` on a focused input is a repaint on every keystroke, and a form is the
   * one surface on this site with a conversion cost attached to friction.
   *
   * So the restraint here is what makes the extremity elsewhere legible. If every
   * surface arrived out of focus, none of them would read as emphasised.
   */
  proseArrival(root) {
    const els = [...hooks(root, "prose"), ...hooks(root, "row"), ...hooks(root, "form")]
    if (!els.length) return []

    return [
      entrance(root, els, { opacity: 0, translateY: 8 }, () =>
        animate(
          els,
          { opacity: 1, translateY: 0 },
          { duration: DUR.d5, delay: stagger(ms(90)), ease: EASE.out },
        ) as Handle,
      ),
    ]
  },
}

/**
 * The scrubbed effects, wired only for whichever of them this section contains.
 *
 * All three are opt-in by markup: a section with no `.ledger-rail` gets no rail
 * observer, one with no `.band-tone` gets no tone. Nothing is registered
 * speculatively, so the observer count matches what is actually on the page.
 */
function mountScrollLinked(_root: Element): ScrollHandle[] {
  /*
   * ── THIS FUNCTION IS NOW EMPTY, AND THAT IS THE FINISHED STATE ───────────────
   *
   * Both scrubbed effects moved to the Framer layer, which owns their elements
   * outright. Neither was left dormant here: two systems writing one property is
   * the failure the ownership rule in ./fm/variants.ts exists to prevent, and a
   * dormant copy is one edit away from being live again.
   *
   *   THE READING RAIL  → components/motion/fm/ledger-rail.tsx
   *     Scrubbed `.ledger-rail-fill` linearly from scaleY(0) to scaleY(1) across
   *     READ_OFFSET. The replacement is spring-led rather than linear, which is
   *     the smoothing ./scroll.ts:50-58 records as missing from the vanilla
   *     `scroll()`, and adds a velocity-reactive head at the leading edge, so the
   *     rail reports reading SPEED as well as position. It is also gated to
   *     `lg` and above, because `.ledger-rail` is `hidden lg:block` and the old
   *     version subscribed on phones to drive an element that never painted.
   *
   *   THE BAND TONE  → components/motion/fm/band-tone.tsx
   *     Scrubbed `.band-tone`'s opacity up then down across BAND_OFFSET. The
   *     replacement scrubs the gradient's alpha AND travels its radial centre from
   *     the edge the reader entered by to the edge they leave by, so the wash says
   *     where in the band they are rather than only that they are in one. That
   *     needs `useMotionTemplate`, which has no vanilla equivalent.
   *
   * WHAT STAYS HERE: everything that is an ENTRANCE. `mountSection` below still
   * runs the six recipes and the band edge, and those are shared with four other
   * routes. The boundary is now clean and statable, ./sections.ts animates
   * arrivals, ./fm/ animates the scroll.
   *
   * The parameter is kept, prefixed, so the call site below reads unchanged and
   * the next scroll-linked effect that IS vanilla has an obvious home.
   */

  /*
   * NO SCROLL-LINKED OPACITY ON THE WALL NUMERALS, DELIBERATELY.
   *
   * An earlier version of this scrubbed them from 0.22 to 0.55 as the band
   * crossed the viewport. It was removed when `countNumerals` landed in
   * ./interactions.ts: that recipe counts each ordinal's DIGITS up to its
   * rendered value on arrival, and a second effect driving `opacity` on the same
   * elements would have been two animations writing one property, the count
   * would have played against a figure still fading, and whichever wrote last
   * would win on any given frame.
   *
   * One effect per element. The wall's motion is the count. That rule is what the
   * two hand-offs above follow, and it is why they were deletions rather than
   * additions.
   */

  return []
}

/**
 * Mount one section's motion. Returns a teardown that reverts all of it.
 *
 * The caller (./section-scope.tsx) owns the reduced-motion check, this is never
 * called when the visitor has asked for less motion, so nothing here needs its own
 * guard. That mirrors ./hero.ts exactly.
 */
export function mountSection(root: HTMLElement, recipe?: RecipeName): () => void {
  const mounted = recipe ? RECIPES[recipe](root) : []

  /*
   * The band's top edge draws for EVERY section that renders one, independently of
   * which recipe it uses.
   *
   * It belongs here rather than inside a recipe because it is a property of the
   * BAND, not of the band's contents: the four home-page sections that carry one
   * use four different recipes between them, and duplicating the same eight lines
   * into each would mean a fifth recipe added later silently loses the edge.
   *
   * `:scope >` so a section only ever draws its own edge, without it a nested
   * section would re-animate its parent's.
   */
  const edge = toArray(root.querySelectorAll(":scope > .band-edge"))
  if (edge.length) {
    mounted.push(
      entrance(root, edge, { scaleX: 0 }, () =>
        animate(edge, { scaleX: 1 }, { duration: DUR.d6, ease: EASE.rule }) as Handle,
      ),
    )
  }

  const scrollHandles = mountScrollLinked(root)

  return () => {
    mounted.forEach((m) => m.cleanup())
    // Every scroll observer MUST be stopped, or a client-side navigation between
    // these five routes leaks one per visit, the same failure the listener
    // bookkeeping in ./interactions.ts exists to prevent.
    scrollHandles.forEach((stop) => stop())
  }
}
