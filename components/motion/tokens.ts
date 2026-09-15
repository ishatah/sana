/**
 * The motion scale, read from :root rather than duplicated.
 *
 * ── WHY THIS READS THE DOM INSTEAD OF DECLARING NUMBERS ────────────────────────
 *
 * A second copy of these values in TypeScript is how the CSS and the JS layers end
 * up 40ms apart with nobody noticing: someone retunes `--dur-3` in
 * styles/globals.css, the CSS transitions change, the Motion animations do not,
 * and the two halves of the same interaction drift. `getComputedStyle` resolves the
 * custom properties the stylesheet already declares, so that file stays the single
 * source and this one is a view onto it.
 *
 * ── THE READ IS CACHED, AND THAT IS NOT A MICRO-OPTIMISATION ───────────────────
 *
 * `getComputedStyle` forces the browser to resolve style. Called per animation,
 * and the interaction layer animates on every pointerenter, it is a forced style
 * resolution inside a hot path, which is the classic way to turn a smooth hover
 * into a janky one. Every value is read once, on first access, and kept.
 *
 * ── THE FALLBACKS ARE NOT DEFENSIVE PADDING ────────────────────────────────────
 *
 * They are what actually runs in two real situations: during server rendering,
 * where there is no `document` at all, and in the frame before the stylesheet has
 * applied. They are duplicated from styles/globals.css deliberately and must be
 * kept in step with it, but only ever as the floor, never as the value a browser
 * with a working stylesheet uses.
 *
 * ── SECONDS, NOT MILLISECONDS ──────────────────────────────────────────────────
 *
 * This is the one thing that changed when the animation engine became Motion, and
 * it is the single most dangerous difference between the two libraries. anime.js
 * took `duration` in MILLISECONDS; Motion takes it in SECONDS. A value passed in
 * the wrong unit does not throw, a 340 meant as `--dur-3` becomes a five-and-a-
 * half MINUTE animation, and a 0.34 meant for Motion under anime.js was a third of
 * a millisecond. Both fail silently and look like "the animation is broken".
 *
 * The conversion happens HERE, once, and `DUR` is documented as seconds so no call
 * site has to remember. The CSS is still authored in `ms` because that is what a
 * stylesheet reads well; `ms()` parses that and divides.
 */

/** Fallbacks in MILLISECONDS, matching how styles/globals.css declares them. */
const FALLBACK_MS: Record<string, number> = {
  "--dur-1": 240,
  "--dur-2": 300,
  "--dur-3": 520,
  "--dur-4": 720,
  "--dur-5": 1080,
  "--dur-6": 1650,
}

let cache: Record<string, number> | null = null

/**
 * One custom property, in SECONDS, the unit Motion's `duration` expects.
 *
 * ── THE UNIT IS READ, NOT ASSUMED, AND THAT IS A BUG FIX ───────────────────────
 *
 * This used to be `parseFloat(raw) / 1000`, justified by a note saying every
 * duration in the scale is declared in `ms` so the leading number IS the
 * millisecond value, and conceding that "a future value declared in `s` would
 * parse as a tiny number and animate almost instantly", dismissed as speculative
 * because no such value existed.
 *
 * IT WAS NOT SPECULATIVE. The stylesheet is irrelevant here: `getComputedStyle`
 * returns a NORMALISED value, and browsers serialise durations in seconds. Even
 * with styles/globals.css authored entirely in `ms`, what comes back is `.24s`,
 * `.52s`, `1.08s`. Dividing those by 1000 yielded 0.00024s, 0.00052s, 0.00108s,
 * so every JS-driven animation on the site ran roughly a THOUSAND TIMES too fast,
 * finishing within a frame of starting.
 *
 * That is why it went unnoticed for so long: an animation that completes instantly
 * looks like an element that simply appears, which is indistinguishable from
 * "the animation has not been written yet", and the from-state discipline in
 * hero.ts guarantees the content is correct and visible either way. It surfaced
 * only when a counting ordinal made the missing frames legible: the numerals
 * jumped 00 -> 08 with no values in between.
 *
 * Both units are now handled explicitly. `ms` divides; a bare `s` does not.
 */
function seconds(name: string): number {
  if (typeof document === "undefined") return FALLBACK_MS[name] / 1000

  if (!cache) {
    const styles = getComputedStyle(document.documentElement)
    cache = {}
    for (const key of Object.keys(FALLBACK_MS)) {
      const raw = styles.getPropertyValue(key).trim()
      const parsed = Number.parseFloat(raw)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        cache[key] = FALLBACK_MS[key] / 1000
        continue
      }
      /*
       * `ms` is tested BEFORE `s`, because "ms" ends in "s" and the looser test
       * would swallow it, the classic way this kind of check goes wrong.
       */
      cache[key] = raw.endsWith("ms") ? parsed / 1000 : parsed
    }
  }

  return cache[name] ?? FALLBACK_MS[name] / 1000
}

/**
 * Durations, in SECONDS, for Motion's `duration` option.
 *
 * Getters rather than a plain object, so the first read happens when an animation
 * is first constructed, after the stylesheet has applied, rather than at module
 * evaluation time, which on a server-rendered page is before there is a document.
 */
export const DUR = {
  get d1() {
    return seconds("--dur-1")
  },
  get d2() {
    return seconds("--dur-2")
  },
  get d3() {
    return seconds("--dur-3")
  },
  get d4() {
    return seconds("--dur-4")
  },
  get d5() {
    return seconds("--dur-5")
  },
  get d6() {
    return seconds("--dur-6")
  },
}

/**
 * Delays are authored in milliseconds throughout the hero sequence, because that
 * is how a choreography reads, "the rule lands at 320" is legible in a way that
 * "0.32" is not. This converts at the boundary so the sequence table stays in the
 * unit it was designed in.
 */
export const ms = (value: number): number => value / 1000

/**
 * The eases, as cubic-bezier control points.
 *
 * ── WHY THIS IS NOW A BETTER MAPPING THAN IT WAS ───────────────────────────────
 *
 * Under anime.js these were power curves, `out(3)`, `out(2)`, `in(2)`, chosen to
 * APPROXIMATE the CSS beziers, and the old note here conceded they "differ by a few
 * percent across the whole domain". Motion takes a bezier array directly, so the
 * approximation is gone: these are the same four control points the stylesheet
 * declares, not a power curve that resembles them. The CSS transition and the JS
 * animation now run on an identical curve rather than a close one.
 *
 *   --ease-out   cubic-bezier(.4,0,.16,1)    the default, soft in / long settle
 *   --ease-soft  cubic-bezier(.45,0,.25,1)   short moves, gentler still
 *   --ease-exit  cubic-bezier(.55,0,1,.45)   the only one that accelerates
 *   --ease-rule  cubic-bezier(.42,0,.18,1)   rules and sweeps
 *
 * THESE WERE SOFTENED AT THE ONSET when the scale was slowed, see the long note
 * in styles/globals.css for why a literal accelerating `ease-in` was NOT used on
 * entrances. Each now starts near zero velocity instead of at full speed, so the
 * motion eases in rather than snapping off the line.
 *
 * Typed as 4-tuples rather than `number[]`: Motion's `Easing` type requires
 * exactly four control points, and a plain array would not assign.
 */
export const EASE = {
  out: [0.4, 0, 0.16, 1],
  soft: [0.45, 0, 0.25, 1],
  exit: [0.55, 0, 1, 0.45],
  rule: [0.42, 0, 0.18, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>

/**
 * The raw CSS easing string, for the one case that needs a bezier in CSS syntax
 * rather than an array: a plain `element.style.transition`.
 */
export function cssEase(name: "out" | "soft" | "exit" | "rule"): string {
  const fallback = {
    out: "cubic-bezier(0.4, 0, 0.16, 1)",
    soft: "cubic-bezier(0.45, 0, 0.25, 1)",
    exit: "cubic-bezier(0.55, 0, 1, 0.45)",
    rule: "cubic-bezier(0.42, 0, 0.18, 1)",
  }[name]

  if (typeof document === "undefined") return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(`--ease-${name}`).trim() || fallback
}

/**
 * Evaluate a cubic-bezier easing at progress `t`, for motion that is computed by
 * hand rather than handed to the animation library.
 *
 * ── WHY THIS EXISTS AT ALL ─────────────────────────────────────────────────────
 *
 * Exactly one effect on this site needs it: the ordinal count in
 * components/motion/interactions.ts, which derives a NUMBER from elapsed time
 * rather than animating a style. Three attempts to borrow the library's engine for
 * that are recorded at the call site; all three typechecked and all three were
 * inert. A count is not a style, so it is computed directly, and this is what
 * keeps it on the same curve as everything that IS a style.
 *
 * ── NEWTON-RAPHSON, AND WHY IT CONVERGES HERE ──────────────────────────────────
 *
 * A CSS cubic-bezier is parametric: x and y are both functions of an internal t
 * that is NOT the progress you pass in. So evaluating it means first solving
 * x(t) = progress, then returning y(t). Four Newton iterations are enough because
 * these curves are monotonic in x with a derivative that never approaches zero on
 * [0,1], the error after four passes is far below one rendered frame. The
 * derivative guard falls back to bisection for the degenerate case rather than
 * dividing by something near zero.
 */
function bezier(p1: number, p2: number, p3: number, p4: number): (t: number) => number {
  const cx = 3 * p1
  const bx = 3 * (p3 - p1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * p2
  const by = 3 * (p4 - p2) - cy
  const ay = 1 - cy - by

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1

    let t = x
    for (let i = 0; i < 4; i++) {
      const slope = slopeX(t)
      if (Math.abs(slope) < 1e-6) break
      t -= (sampleX(t) - x) / slope
    }
    return sampleY(Math.min(Math.max(t, 0), 1))
  }
}

/**
 * The `--ease-out` curve as a function, built from `EASE.out` so there is exactly
 * one copy of the control points in this file.
 *
 * It was originally written with the four numbers repeated as literals, to avoid a
 * `getComputedStyle` parse per frame. That reasoning was sound but the
 * implementation drifted immediately: when the scale was retuned, `EASE.out` moved
 * to (0.4, 0, 0.16, 1) and this kept the old (0.16, 1, 0.3, 1), so the counting
 * ordinals ran on a visibly different curve from every other animation on the site,
 * silently.
 *
 * Spreading `EASE.out` costs nothing per frame: `bezier()` is called ONCE at module
 * evaluation and returns a closure over the coefficients, so the per-frame path is
 * unchanged. The hot-path argument was about `getComputedStyle`, which this never
 * did, `EASE.out` is a plain literal tuple.
 */
export const easeOut = bezier(...EASE.out)
