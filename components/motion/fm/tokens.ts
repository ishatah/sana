import { DUR, EASE, ms } from "../tokens"

/**
 * The motion scale, re-exported for the Framer layer.
 *
 * ── WHY THIS FILE IS A RE-EXPORT AND NOT A SECOND SCALE ────────────────────────
 *
 * ../tokens.ts already reads `--dur-*` and `--ease-*` from :root and explains at
 * length why a second copy in TypeScript is how the CSS and JS halves of one
 * interaction end up 40ms apart. That argument does not weaken because a second
 * animation library arrived, it strengthens, because there are now two engines
 * that must agree with the stylesheet AND with each other.
 *
 * So this file adds no values. It re-exports, and it types them for Framer.
 *
 * ── SECONDS. STILL SECONDS. ────────────────────────────────────────────────────
 *
 * `DUR.*` returns SECONDS, which is what both the vanilla `animate()` and Framer's
 * `Transition.duration` expect. The unit hazard documented in ../tokens.ts is
 * unchanged here: a raw millisecond number does not throw, it schedules an
 * animation lasting minutes. Never write a literal duration at a call site.
 *
 * `ms()` is re-exported for the one legitimate case, a choreography table
 * authored in milliseconds because "the rule lands at 320" reads better than
 * "0.32", and it converts at the boundary.
 */

export { DUR, EASE, ms }

/**
 * The eases, widened to Framer's `Easing` shape.
 *
 * `EASE` is declared `as const` in ../tokens.ts, which makes each entry a
 * `readonly [number, number, number, number]`. Framer's `Transition.ease` accepts
 * a MUTABLE `number[]` of length four, and a `readonly` tuple does not assign to
 * it, so every call site would otherwise need its own spread or cast.
 *
 * Doing the widening once, here, means no call site casts. The spread also copies,
 * so nothing downstream can mutate the shared tuple in ../tokens.ts.
 */
type Bezier = [number, number, number, number]

export const FM_EASE: Record<keyof typeof EASE, Bezier> = {
  out: [...EASE.out] as Bezier,
  soft: [...EASE.soft] as Bezier,
  exit: [...EASE.exit] as Bezier,
  rule: [...EASE.rule] as Bezier,
}

/**
 * The spring every travelling element on this site uses.
 *
 * ── CRITICALLY DAMPED, AND THAT IS NOT A STYLE PREFERENCE ──────────────────────
 *
 * ζ = damping / (2 * sqrt(stiffness * mass)) = 32 / (2 * sqrt(260 * 0.9)) ≈ 1.05.
 * Just past critical, so it settles without crossing its target. There is no
 * overshoot and no bounce.
 *
 * That is a requirement rather than a taste: data/exclusions.json logs intake
 * section 3's ban on `العناصر الحركية الزائدة` against a requested character of
 * `رسمي · قيادي`, and components/motion/hero.ts:348-359 already argues that a
 * visible bounce is precisely what that clause rules out. The one spring the site
 * had before this layer existed, the hero role-line width, is declared
 * `bounce: 0` for the same reason.
 *
 * Use this for anything that TRAVELS between two positions. Scroll-scrubbed
 * values use `SCRUB_SPRING` below instead; a scrub is not a journey.
 */
export const TRAVEL_SPRING = {
  type: "spring" as const,
  stiffness: 260,
  damping: 32,
  mass: 0.9,
}

/**
 * The smoothing applied to a raw scroll progress value.
 *
 * ── THIS IS THE CAPABILITY THE VANILLA LAYER DOES NOT HAVE ─────────────────────
 *
 * components/motion/scroll.ts:50-58 records that Motion's vanilla `scroll()` has
 * no smoothing option, anime.js had `sync: 0.25` and nothing replaced it, and
 * mitigates the absence by scrubbing only compositor-only properties so the
 * unsmoothed jitter is at least cheap.
 *
 * `useSpring(scrollYProgress, …)` IS that missing smoothing. Feeding raw progress
 * through a spring gives the scrubbed value inertia: it tracks the scroll closely
 * but rounds off the per-frame steps a trackpad produces.
 *
 * `restDelta` matters for a different reason than it usually does. A spring that
 * never reaches rest keeps scheduling animation frames forever, so an unsettled
 * spring is a permanent rAF loop on an idle page. At this delta the spring parks,
 * and the idle-cost check in the plan's leak test is what verifies it.
 */
export const SCRUB_SPRING = {
  stiffness: 90,
  damping: 26,
  mass: 0.6,
  restDelta: 0.0005,
}

/**
 * The scroll offsets, matching the two the vanilla layer already declares in
 * components/motion/scroll.ts so both layers frame the viewport identically.
 *
 *   BAND, the full crossing, edge to edge. For anything that should respond to a
 *          section entering and leaving.
 *   READ, the reading zone, narrower and biased upward: a row "counts" once it
 *          enters the lower part of the viewport and is done by the upper middle.
 *          For progress through a list the visitor is actually reading. The exact
 *          percentages differ from the vanilla layer's, see the ⚠️ below.
 *
 * ⚠️ READ IS `["start 95%", "end 25%"]`, NOT THE VANILLA `["start 85%", "end 55%"]`,
 * AND THE DIFFERENCE IS A BUG FIX RATHER THAN A PREFERENCE.
 *
 * A scroll offset names two viewport positions: where the target's START edge
 * produces progress 0, and where its END edge produces progress 1. The distance
 * the target travels between those two moments is
 *
 *     target height + (first % − second %) × viewport height
 *
 * With 85/55 the second term is only 30% of the viewport, so a SHORT target has
 * very little total travel, and once the target is short enough, the two
 * conditions effectively coincide and a scrubbed value sits pinned at one end for
 * the whole crossing.
 *
 * That is not hypothetical here. Measured on this page at 828px of viewport: the
 * expertise list is 296px and the roles rail 216px. Both scrubbed values rendered
 * `transform: none` for the entire band, the marks and the rail never moved.
 *
 * 95/25 gives 70% of the viewport of travel on top of the target's own height,
 * which is enough for every list on this page with a wide margin, and keeps the
 * upward bias that makes this a READING window: a row counts as it enters the
 * lower viewport and is finished well before it leaves the top.
 *
 * THE VANILLA LAYER HAS THE SAME LATENT ISSUE and is left alone deliberately,
 * its only consumer of READ_OFFSET was the rail this layer has now taken over, so
 * changing it there would be editing a constant nothing reads. If a vanilla
 * scrubbed effect is ever added back, this note is the reason to widen it too.
 *
 * ── A SHORT TARGET NEEDS A LONG WINDOW, WHICH IS THE GENERAL RULE ─────────────
 *
 * Before scrubbing anything, check the target's height against the viewport. If
 * it is under about half a screen, the window between the two offset stops has to
 * carry the travel, because the element itself contributes almost none.
 *
 * ── THE TYPE HAS TO BE LITERAL *AND* MUTABLE, WHICH TAKES BOTH ANNOTATIONS ─────
 *
 * The React `useScroll` types its `offset` as a mutable array of a union of
 * template literal types (`"start end"`, `` `${number}%` ``, and some sixty
 * others). Satisfying that needs two things at once, and the obvious spellings
 * each get exactly one:
 *
 *   `[string, string]`, mutable, but the literals have already widened to
 *                         `string` and `string` is not in the union.
 *   `as const`, preserves the literals, but makes the tuple `readonly`,
 *                         which does not assign to a mutable array.
 *
 * An explicit tuple annotation of the literal types gives both: the literals are
 * pinned by the annotation rather than by `as const`, and the tuple stays mutable.
 *
 * Declared once here so no call site carries a cast, a cast at a call site is how
 * a wrong offset eventually gets past the compiler.
 */
export const FM_BAND_OFFSET: ["start end", "end start"] = ["start end", "end start"]
export const FM_READ_OFFSET: ["start 95%", "end 25%"] = ["start 95%", "end 25%"]
