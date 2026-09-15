import { DUR, FM_EASE } from "./tokens"
import type { EntrancePhase } from "./use-entrance"

/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  THE OWNERSHIP RULE, READ THIS BEFORE ADDING ANYTHING TO THIS DIRECTORY
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *  Every `data-anime` hook is owned by ../sections.ts and ../hero.ts.
 *  Every `data-fm` hook is owned by this directory.
 *  NO ELEMENT CARRIES BOTH. No element is written by both systems on the same
 *  property.
 *
 * ── WHY TWO SYSTEMS EXIST AT ALL ───────────────────────────────────────────────
 *
 * This site runs two animation layers on purpose, not as a migration left half
 * finished.
 *
 * The VANILLA layer (../sections.ts, ../hero.ts, ../interactions.ts) is the
 * entrance and interaction layer. It animates server-rendered markup from the
 * outside, which is what lets every page section stay a SERVER component.
 * Rewriting it in React would mean converting Hero, AboutSection, ExpertiseGrid,
 * RoleEntryList, SectionHeader and ContactSection into client components,
 * shipping every `localize()` call for both locales to the browser and
 * re-deriving the `publishable()` counts client-side. app/[locale]/page.tsx:199-212
 * and app/[locale]/layout.tsx:68-78 were both written to avoid exactly that cost.
 * Those recipes are also shared with four other routes.
 *
 * The FRAMER layer (this directory) is the expressive layer: scroll-scrubbed,
 * spring-driven, presence-driven and cursor-reactive effects that the vanilla API
 * either cannot express or expresses badly. Three of its capabilities are genuine
 * gains rather than restatements, `useSpring` on scroll progress is the smoothing
 * ../scroll.ts:50-58 records as missing, `useMotionTemplate` has no vanilla
 * equivalent, and `layout` projection replaces ~180 lines of manual measurement.
 *
 * ── THE FAILURE THE RULE PREVENTS, CONCRETELY ──────────────────────────────────
 *
 * ../sections.ts `entrance()` calls `setStyles(targets, { opacity: 0,
 * translateY: 12 })`, which ../dom.ts composes into ONE `transform` string and
 * writes inline. A `m.div` on the same node writes `transform` from its own
 * MotionValue, also inline. Both are valid, neither errors, and whichever runs
 * last on a given frame wins, so the element visibly fights itself, at a rate
 * that depends on scroll speed and frame timing. It is the hardest class of bug to
 * reproduce and the easiest to prevent.
 *
 * The dev-time audit in ./audit.ts asserts `[data-anime][data-fm]` is empty.
 *
 * ── THE FOUR HAND-OFFS ALREADY MADE ────────────────────────────────────────────
 *
 * Where this layer took over an element, the vanilla effect was DELETED in the
 * same change rather than left dormant:
 *
 *   ../hero.ts      portraitDrift()          → A1  (absorbs its 8px as one term)
 *   ../hero.ts      rotateRoles()            → A7  (~180 lines removed)
 *   ../sections.ts  the .band-tone scrub     → A6
 *   ../sections.ts  the .ledger-rail scrub   → A8
 *
 * ── THE RULE THE VANILLA LAYER STATES AND THIS ONE INHERITS ────────────────────
 *
 * ONE EFFECT PER ELEMENT. ../sections.ts:371-383 records why a scroll-linked
 * opacity on the expertise numerals was removed once `countNumerals` landed: two
 * effects writing one property is two animations racing, and whichever writes last
 * wins the frame. That rule is not relaxed because the second writer is React.
 */

/**
 * Every entrance variant object has this shape.
 *
 * `rest` MUST equal `in`. It is the no-JS floor, the reduced-motion resting state,
 * and where ./use-entrance.ts's deadline lands, so it has to be the finished,
 * readable state. See that file for the full three-layer argument.
 */
export type EntranceVariants = Record<EntrancePhase, Record<string, unknown>>

/**
 * `from` is a JUMP, not a move.
 *
 * Animating INTO the hidden state would show content retreating before it arrives
 *, the backwards-entrance failure ../sections.ts:51-55 describes as "the worst
 * possible teardown". A zero duration makes the hidden state a single committed
 * frame instead.
 */
const INSTANT = { transition: { duration: 0 } }

/**
 * A block-axis clip reveal: the element is uncovered in place, from its top edge.
 *
 * ── NO TRANSLATE, AND THAT IS THE DESIGN ───────────────────────────────────────
 *
 * The `.panel-wipe` note in styles/globals.css argues that a moving box is the
 * wrong gesture for a grid, cards that slide into position read as a template
 * animating itself, where cards uncovered in place read as printing. ../sections.ts
 * `ledgerRows` and `panelGrid` both already follow this; the Framer layer matches
 * them so the two systems produce one language rather than two.
 *
 * RTL: `inset()` on the BLOCK axis. Top and bottom do not mirror. Safe by
 * construction, which is the preference ../interactions.ts:147-152 states.
 */
export const clipReveal: EntranceVariants = {
  rest: { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" },
  from: { opacity: 0, clipPath: "inset(0% 0% 100% 0%)", ...INSTANT },
  in: {
    opacity: 1,
    clipPath: "inset(0% 0% 0% 0%)",
    transition: { duration: DUR.d4, ease: FM_EASE.out },
  },
}

/**
 * The quiet entrance: opacity and a short block-axis rise.
 *
 * 12px matches `RISE` in ../sections.ts. The number is small on purpose, the
 * argument in ../hero.ts:446-453 for the 8px portrait drift applies here too: a
 * distance a reader can consciously name is too far.
 *
 * RTL: `y` only. Safe by construction.
 */
export const riseIn: EntranceVariants = {
  rest: { opacity: 1, y: 0 },
  from: { opacity: 0, y: 12, ...INSTANT },
  in: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.d5, ease: FM_EASE.out },
  },
}

/**
 * A mask wipe that uncovers text without touching the text node.
 *
 * ── WHY A MASK AND NOT `background-clip: text` ─────────────────────────────────
 *
 * ../hero.ts:180-189 records why `background-clip` failed on this site: it clips
 * to the ELEMENT BOX, not to the glyphs, so on a block-level heading the gradient's
 * opaque region sits past the end of the inked text and the first N pixels render
 * transparent, the subject's name rendered as "akik". A mask composites against
 * already-painted glyphs, so there is no fill-colour indirection and no such
 * failure.
 *
 * ── AND WHY NOT `splitText` ────────────────────────────────────────────────────
 *
 * Per-character reveals are forbidden here. ../sections.ts:136-140,
 * ../section-header.tsx and ../hero.tsx:283-291 all state it: organisation names
 * and the subject's own name must render as single intact text nodes. This mask
 * animates ONE CSS property on an element whose children are untouched, which is
 * how a sweep is done on this site. scripts/check-publish-gate.mjs now enforces it.
 *
 * The angle is supplied per call site from ./use-direction.ts, a heading must
 * uncover from the READING edge, and a gradient angle is physical. `maskSize` and
 * `maskRepeat` are pinned because components/about-section.tsx:151-168 records
 * that a gradient mask ending before 100% tiles by default and repaints the very
 * edge it was hiding.
 *
 * REDUCED MOTION: `rest` is `mask-image: none`, so the resting state is an
 * unmasked heading rather than a mask parked at a safe offset. That matters more
 * here than anywhere else in this file, `mask-image` is NOT covered by the
 * `[data-anime] { transform: none }` floor in styles/globals.css, so a heading
 * stranded mid-mask is completely invisible text. The `[data-fm]` floor added for
 * this layer covers both the prefixed and unprefixed property.
 */
export function maskSweep(angle: string): EntranceVariants {
  const base = {
    maskSize: "100% 100%",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
  }

  const at = (stop: number) =>
    `linear-gradient(${angle}, #000 ${stop}%, transparent calc(${stop}% + 14%))`

  return {
    rest: { maskImage: "none", WebkitMaskImage: "none" },
    from: { ...base, maskImage: at(0), WebkitMaskImage: at(0), ...INSTANT },
    in: {
      ...base,
      maskImage: at(130),
      WebkitMaskImage: at(130),
      transition: { duration: DUR.d6, ease: FM_EASE.rule },
    },
  }
}
