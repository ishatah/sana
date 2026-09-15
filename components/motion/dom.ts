/**
 * The two anime.js utilities Motion does not ship, reimplemented.
 *
 * anime.js had `utils.set()` (write a from-state instantly) and `utils.remove()`
 * (drop the inline styles it wrote). Motion has no equivalent: `animate(el, v, {
 * duration: 0 })` is close to the first but still schedules a frame, which is
 * exactly wrong for a from-state that must land BEFORE the browser paints. So both
 * are direct style writes here.
 *
 * ── WHY A FROM-STATE MUST BE SYNCHRONOUS ───────────────────────────────────────
 *
 * The whole safety argument of this codebase's motion layer is that markup ships
 * visible from the server and is hidden only at the instant something is queued to
 * reveal it again. If the hide lands one frame late, the visitor sees a flash of
 * the finished layout before it collapses to its from-state, which is worse than
 * either having the animation or not having it. A synchronous style write cannot
 * be late.
 *
 * ── THE PROPERTY SHIM, AND THE BUG THAT DICTATES ITS SHAPE ─────────────────────
 *
 * anime.js accepted `translateY`, `scaleX` and friends as top-level keys and
 * composed them into one transform. The browser has no such properties, so they
 * have to be mapped onto something real, and WHICH real property is not a free
 * choice.
 *
 * An earlier version of this file wrote the individual transform properties
 * (`el.style.translate`, `el.style.scale`, `el.style.rotate`). That is the more
 * modern CSS, and the reasoning for it was that independent axes compose without a
 * transform string and cannot clobber each other. It was also BROKEN, in a way that
 * left the hero visibly wrong on every load:
 *
 *   Motion animates `x`/`y`/`scale`/`rotate` by composing them into the `transform`
 *   property. `translate` and `transform` are SEPARATE properties that both apply,
 *   so a from-state of `translate: 0 18px` was never touched by an animation
 *   writing `transform`. Motion faithfully animated transform from its start value
 *   to `none`, the entrance "completed", and every hero element stayed parked 18px
 *   down and scaled at 1.04 for the life of the page. No error, no warning: the
 *   computed style just read `translate: 0px 18px; transform: none`.
 *
 * So these keys map onto a composed `transform` STRING, because that is the
 * property Motion owns. The from-state and the animation now write the same place,
 * which is the only arrangement in which one can supersede the other.
 *
 * Anything not in the map is set as a plain CSS property, so `opacity`, `height`
 * and `clipPath` pass straight through.
 */

type StyleValues = Record<string, string | number>

/** Elements, one or many, as an array, the shape every helper here works on. */
export function toArray(target: Element | Element[] | NodeListOf<Element> | null): HTMLElement[] {
  if (!target) return []
  if (target instanceof Element) return [target as HTMLElement]
  return Array.from(target) as HTMLElement[]
}

/**
 * Numbers that need a unit when they reach CSS.
 *
 * `translateZ` and `z` are here for the same reason `translateY` is, a bare
 * number in a transform function is invalid CSS and the whole `transform`
 * declaration is discarded, silently taking every other function in the string
 * with it. That is worse than the property being ignored: a from-state that fails
 * to parse leaves the element at its FINISHED position, so the entrance appears to
 * work while animating nothing.
 */
const PX = new Set(["translateX", "translateY", "translateZ", "z", "height", "width", "top", "y", "x"])

function cssValue(key: string, value: string | number): string {
  if (typeof value === "string") return value
  return PX.has(key) ? `${value}px` : String(value)
}

/**
 * The transform keys this codebase sets, in the order Motion composes them.
 *
 * ORDER MATTERS AND IS NOT ALPHABETICAL. Transform functions apply right-to-left,
 * so `translate(…) scale(…)` and `scale(…) translate(…)` place an element
 * differently once the scale is not 1, the hero's portrait sets both. This is
 * Motion's own order (translate, scale, rotate), so the from-state written here and
 * the value Motion animates to describe the same geometry.
 */
const TRANSFORM_ORDER = [
  "x",
  "translateX",
  "y",
  "translateY",
  /*
   * ── THE DEPTH KEYS, ADDED FOR THE 3D ENTRANCES ──────────────────────────────
   *
   * `panelGrid`, `markWall` and `ledgerRows` in ./sections.ts animate `translateZ`
   * and `rotateX`. A key that is NOT in this list is not merely un-composed, it
   * falls through to the `else` branch below and is written as a raw CSS property
   * (`el.style.translateZ = "-40"`), which does not exist, so the browser drops it
   * and the from-state is silently never applied.
   *
   * That is exactly how this shipped broken once: the depth term was written, the
   * animation ran, and the panels never moved on the Z axis at all. It was caught
   * by reading `getComputedStyle(panel).transform` during the entrance and finding
   * `none` on every frame.
   *
   * ORDER: translate → rotate → scale is Motion's own composition order, and the
   * Z terms sit with their axis-mates so a from-state written here and the value
   * Motion animates to describe the same geometry. `rotateX` before `scale`
   * matters once both are non-identity, which is the roles ledger's case.
   */
  "translateZ",
  "z",
  "rotateX",
  "rotateY",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
] as const

function transformFn(key: string, raw: string | number, value: string): string {
  switch (key) {
    case "x":
    case "translateX":
      return `translateX(${value})`
    case "y":
    case "translateY":
      return `translateY(${value})`
    case "scale":
      return `scale(${value})`
    case "scaleX":
      return `scaleX(${value})`
    case "scaleY":
      return `scaleY(${value})`
    case "translateZ":
    case "z":
      return `translateZ(${value})`
    /*
     * The three rotations take DEGREES. A bare number is invalid inside a rotate
     * function, unlike a translate, where the browser at least has a default
     * length interpretation to reject, so the unit is appended here rather than
     * via `PX`, which appends `px` and would produce `rotateX(-8px)`.
     */
    case "rotateX":
      return `rotateX(${typeof raw === "number" ? `${raw}deg` : value})`
    case "rotateY":
      return `rotateY(${typeof raw === "number" ? `${raw}deg` : value})`
    case "rotate":
      return `rotate(${typeof raw === "number" ? `${raw}deg` : value})`
    default:
      return ""
  }
}

/**
 * Write styles immediately, with no animation and no scheduled frame.
 *
 * The anime.js `utils.set` replacement. Transform-ish keys are composed into a
 * single `transform` string, see the property-shim note at the top of this file
 * for why it must be `transform` and not the individual `translate`/`scale`
 * properties. Everything else is written as-is.
 */
export function setStyles(
  target: Element | Element[] | NodeListOf<Element> | null,
  values: StyleValues,
): void {
  for (const el of toArray(target)) {
    const parts: string[] = []

    // Walked in TRANSFORM_ORDER rather than in `Object.entries` order, so the
    // composed string does not depend on how the call site happened to spell its
    // object literal.
    for (const key of TRANSFORM_ORDER) {
      if (!(key in values)) continue
      const raw = values[key]
      parts.push(transformFn(key, raw, cssValue(key, raw)))
    }

    if (parts.length) el.style.transform = parts.join(" ")

    for (const [key, raw] of Object.entries(values)) {
      if ((TRANSFORM_ORDER as readonly string[]).includes(key)) continue
      el.style.setProperty(
        key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
        cssValue(key, raw),
      )
    }
  }
}

/**
 * Clear the inline styles this module wrote, returning control to the stylesheet.
 *
 * The anime.js `utils.remove` replacement, and the correct teardown for an
 * entrance: reverting the ANIMATION would play it backwards into its from-state
 * and leave content hidden on unmount. Removing the inline styles instead means the
 * element falls back to whatever the stylesheet says, which for every animated
 * element on this site is the visible, finished state.
 */
export function clearStyles(
  target: Element | Element[] | NodeListOf<Element> | null,
  // `transform`, NOT `translate`/`scale`/`rotate`. Those are the properties this
  // module used to write and no longer does; leaving them in the default list would
  // mean a teardown that clears nothing while the real inline transform survives,
  // which is the same class of silent mismatch documented at the top of this file.
  props: string[] = ["opacity", "transform", "clip-path", "height", "overflow"],
): void {
  for (const el of toArray(target)) {
    for (const prop of props) el.style.removeProperty(prop)
  }
}

/**
 * The shape this codebase needs from a Motion animation, and nothing more.
 *
 * TWO MEMBERS, BOTH ACTUALLY CALLED. `stop()` is what teardown needs; `then()` is
 * what the role crossfade in hero.ts and `track()` in interactions.ts sequence on.
 *
 * `then` IS TYPED LOOSELY ON PURPOSE, and that is the fix rather than the flaw.
 * It used to be spelled `(onResolve: VoidFunction, onReject?: VoidFunction) =>
 * unknown`, an exact transcription of Motion's own signature at the time. Motion
 * 13 returns `AnimationPlaybackControlsWithThen`, whose `then` is generic over its
 * resolve value, and a structural type that pins the parameter types down to
 * `VoidFunction` no longer accepts it: every `animate()` assignment in hero.ts
 * failed to typecheck.
 *
 * The fix is the RETURN types, not the parameters. Both callbacks are now typed
 * `() => unknown` rather than `VoidFunction`: every call site passes a
 * zero-argument function, but two of them return a value incidentally
 * (`running.delete(...)` returns a boolean), and `VoidFunction` rejects that.
 * Widening the return to `unknown` accepts them while still requiring `then` to
 * exist and to take callables.
 *
 * Declared here once rather than in each of the two files that track animations,
 * and declared structurally rather than by importing Motion's internal type names,
 * which are not part of its public surface and have changed between minor versions.
 */
export type Handle = {
  stop: () => void
  /**
   * Jump to the end state immediately.
   *
   * This is what makes the entrance deadline in ./sections.ts a guarantee rather
   * than merely a second trigger: content is correct on the next frame even if the
   * animation was already mid-flight when the deadline fired.
   */
  complete: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then: (...args: any[]) => unknown
}
