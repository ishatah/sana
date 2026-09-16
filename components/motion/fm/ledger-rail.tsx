"use client"

import { Children, useRef, type ReactNode } from "react"
import { m, useScroll, useSpring, useVelocity, useTransform, useReducedMotion } from "motion/react"
import { FmRoot } from "./fm-root"
import { useMediaQuery } from "./use-media"
import { FM_READ_OFFSET } from "./tokens"

/**
 * A8, the reading rail on the roles ledger.
 *
 * ── WHAT THIS REPLACES ─────────────────────────────────────────────────────────
 *
 * `mountScrollLinked()` in ../sections.ts scrubbed `.ledger-rail-fill` linearly
 * from `scaleY(0)` to `scaleY(1)` across the list's reading window. That handle is
 * deleted; this component owns the element.
 *
 * ── WHAT IT ADDS ───────────────────────────────────────────────────────────────
 *
 * Two things, and both are information rather than decoration, which is the test
 * the `.ledger-rail` note in styles/globals.css sets for this element ("unlike most
 * scroll effects it carries INFORMATION, position in a list, rather than
 * decorating the fact that scrolling happened"):
 *
 *   1. THE FILL IS SPRING-LED, not linear. It chases the true reading position
 *      with a slight lag, so the rail reads as something being drawn rather than
 *      as a value being set. ../scroll.ts:50-58 records that the vanilla layer
 *      could not do this, Motion's `scroll()` has no smoothing and `linear()` is
 *      mandatory there for exactly that reason.
 *
 *   2. A HEAD AT THE LEADING EDGE stretches and brightens with scroll velocity,
 *      contracting to a point at rest. That is reading SPEED, which the old rail
 *      could not express. It is also self-limiting: it exists only while the
 *      reader is moving, so a still page shows a still rail.
 *
 * ── AND GATED TO A LIST THAT HAS PROGRESS TO REPORT ───────────────────────────
 *
 * Below two rows the scrub is not mounted at all and the rail renders static.
 * For THIS subject that is the live case, `composeRoles()` folds her position
 * and her membership into a single entry, so the rail is currently inert by
 * design rather than broken. See the gate in the body for the measurements.
 *
 * ── GATED TO THE VIEWPORT THAT ACTUALLY PAINTS IT ──────────────────────────────
 *
 * `.ledger-rail` is `hidden lg:block` (components/role-entry.tsx). Below 1024px it
 * does not render at all, so mounting a scroll subscription and two springs there
 * would be driving a `display: none` element.
 *
 * ../sections.ts:345-351 states the rule the vanilla layer follows, "nothing is
 * registered speculatively, so the observer count matches what is actually on the
 * page", and a React hook has no way to honour that for free. `useMediaQuery` is
 * how this component keeps the same promise.
 *
 * ── SAFETY: THE NO-JS STATE HERE IS UNUSUAL AND WORTH STATING ─────────────────
 *
 * `.ledger-rail-fill` declares `transform: scaleY(0)` in the stylesheet, so unlike
 * every other animated element on this site its DECLARED state is the empty one.
 * That is safe because the rail is pure decoration beside a list that is already
 * complete and readable, an unfilled rail is a quiet rail, not missing content.
 *
 * Under reduced motion the existing floor at styles/globals.css forces
 * `scaleY(1) !important`, which beats anything Framer writes inline, so the rail
 * renders FULL rather than empty. That is the right resting state for a progress
 * indicator that is not going to move: full reads as "complete", empty reads as
 * "broken".
 */

/** The head's length in pixels, long enough to be a gesture, short enough that it
 *  never reads as a second fill. */
const HEAD = 40

export function LedgerRail({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  const wide = useMediaQuery("(min-width: 1024px)")
  /* The list of rows. This is the scroll target, see the note at `useScroll`. */
  const listRef = useRef<HTMLUListElement>(null)

  /*
   * ── A ONE-ROW LIST HAS NO READING PROGRESS, AND THIS IS THE GATE FOR IT ──────
   *
   * Measured on this page: the roles list is ONE row and 216px tall in an 828px
   * viewport. A progress indicator over a single item that fits on screen twice
   * over cannot report anything, the whole list is visible at once, so there is
   * no "how far through" to answer. It fills the instant the band arrives and
   * then sits full, which reads as a loading bar that has finished rather than as
   * a reading rail.
   *
   * That is not a tuning problem to be solved with a wider offset. It is the
   * honest answer for this subject's data: `composeRoles()` folds her position
   * and her membership into one entry, because they describe one organisation.
   *
   * So the rail renders STATIC below two rows, the stylesheet's `scaleY(0)` with
   * no scrub attached, and the effect switches itself on if and when more roles
   * publish. Nothing about this is conditional on the animation being wanted; it
   * is conditional on there being something to measure, which is the same test
   * ../sections.ts:345-351 applies when it registers observers only for markup
   * that is actually present.
   */
  const rows = Children.count(children)
  const measurable = rows >= 2

  /*
   * ── THE TARGET IS THE LIST, NOT THE RAIL, AND THAT IS A BUG FIX ──────────────
   *
   * This first targeted the rail element itself, on the reasoning that it is
   * `inset-block: 0` inside the list's positioned ancestor and so spans the same
   * rows. That is true of its RECT and false of what the rect means.
   *
   * The deleted vanilla scrub in ../sections.ts read
   * `linkProgress(list, …)`, it measured `.thread-steps`, the list of rows, and
   * the rail was only the thing it drew into. Measuring the rail instead ties
   * progress to a decorative element whose box is set by its absolutely-positioned
   * ancestor rather than by the content being read, and the observed result was a
   * rail that reached 0.996 before the band was even on screen and then sat there.
   *
   * `listRef` goes on `.thread-steps`. What fills the rail is now, once again,
   * how far through the ROWS the reader is, which is the only thing that makes
   * this a reading indicator rather than a scroll decoration.
   */
  const { scrollYProgress } = useScroll({ target: listRef, offset: FM_READ_OFFSET })

  /*
   * Stiffer than the hero camera's spring. A reading indicator that lags visibly
   * is worse than one that does not lag at all, it would report a position the
   * reader has already passed. This is enough inertia to round off trackpad steps
   * and not enough to be wrong.
   */
  /* `restDelta` at progress scale (0..1), same value as SCRUB_SPRING in ./tokens.ts.
     Without it this spring never parks, and because `useVelocity` below is chained
     off it, the whole chain stayed awake on an idle page. */
  const fill = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    mass: 0.5,
    restDelta: 0.0005,
  })

  /*
   * Velocity is taken from the SPRING, not from raw progress. Raw progress
   * velocity spikes on every discrete wheel event, which would make the head
   * flicker; the spring's velocity is already smoothed by the spring itself, so
   * the head stretches and settles the way the fill does.
   *
   * The domain is progress-per-second, small numbers, because the whole list is
   * 1.0 of progress. ±3 is a brisk scroll through the section.
   */
  const velocity = useVelocity(fill)
  const headScaleY = useTransform(velocity, [-3, 0, 3], [2.6, 1, 2.6], { clamp: true })
  const headOpacity = useTransform(velocity, [-3, 0, 3], [1, 0.45, 1], { clamp: true })

  /*
   * The head's counter-scale. DECLARED HERE, WITH THE OTHER HOOKS, NOT INLINE IN
   * THE STYLE OBJECT BELOW.
   *
   * It used to be written inline on the `data-fm-head` element, which put a hook
   * call AFTER the reduced-motion/narrow early return. `useMediaQuery` resolves
   * to its real value on the effect after mount, so the first render took the
   * early branch (this hook never ran) and the second took the full branch (it
   * did), "rendered more hooks than during the previous render", and the page
   * fell into app/error.tsx.
   *
   * Every hook in this component must run on every render, whichever branch is
   * taken. See the counter-scale note at the element itself for what it computes
   * and why dividing by the parent's scale is required.
   */
  const headCounterScale = useTransform([fill, headScaleY], ([f, h]: number[]) =>
    f > 0.001 ? h / f : 0,
  )

  /*
   * Both reduced motion and narrow viewports render the plain markup: no Framer
   * runtime, no springs, no subscription. The stylesheet then decides what it
   * looks like, `scaleY(0)` normally, forced to `scaleY(1)` by the reduced-motion
   * floor. See the docblock.
   */
  if (reduced || !wide || !measurable) {
    return (
      /*
       * ⚠️ THE REF IS ATTACHED ON THIS BRANCH TOO, AND THAT IS NOT DECORATION.
       *
       * `useScroll({ target: ref })` above runs on every render, including this
       * one. If the element carrying the ref only exists on the other branch, the
       * hook resolves against a ref whose `.current` is null on the first client
       * render and Motion throws "Target ref is defined but not hydrated" into
       * the console on every load.
       *
       * `wide` is false until `useMediaQuery` subscribes after mount, so this
       * branch ALWAYS renders first on a desktop viewport, the warning was not an
       * edge case, it fired on every visit. Attaching the ref here gives the hook
       * a real element to measure from the first frame, and the branch is still
       * inert: no `m.*`, no `data-fm`, no subscription of its own.
       *
       * ⚠️ AND THE LIST IS RENDERED HERE TOO. This branch is what the SERVER
       * renders, `reduced` and `wide` both resolve only after mount, so it is
       * the markup that has to be complete without JavaScript. A branch that
       * returned the rail alone would ship a roles section with no roles in it.
       */
      <>
        <span aria-hidden className="ledger-rail hidden lg:block">
          <span className="ledger-rail-fill rail-weight" />
        </span>
        <ul ref={listRef} className="depth-stage thread-steps space-y-5">
          {children}
        </ul>
      </>
    )
  }

  return (
    <FmRoot>
      <span aria-hidden className="ledger-rail hidden lg:block">
        {/*
          `scaleY` from `transform-origin: top`, both already declared in the
          stylesheet. BLOCK AXIS, so there is no direction branch here and none is
          needed, the rail is placed with `inset-inline-start`, which the browser
          flips for Arabic on its own. The `.ledger-rail` note in
          styles/globals.css calls this "the one scroll effect that needs no RTL
          correction at all", and that is still true.
        */}
        {/*
          #20 (rail thickens with scroll speed) IS NOT APPLIED TO THIS SPAN.

          `rail-weight` is a CSS `transform: scaleX(...)` driven by
          --scroll-speed, and this element already writes `scaleY` from a
          MotionValue. Both resolve to the SAME `transform` property, so the two
          would overwrite each other every frame, the ownership rule in
          ./variants.ts, and the same conflict that keeps `MassLag` a wrapper.

          The static branch above takes it instead: that span has no MotionValue
          on it, so CSS owns its transform outright. Below 1024px the rail is
          `hidden lg:block` anyway, and the velocity signal is least useful on
          the touch devices that dominate that range.
        */}
        <m.span data-fm className="ledger-rail-fill" style={{ scaleY: fill }}>
          {/*
            The head rides the TOP of the fill's own coordinate space, which is
            what keeps it at the leading edge without a second scroll computation:
            the fill is scaled from its top, so its bottom edge is the moving one,
            and a child pinned to that bottom moves with it for free.

            `transform-origin: bottom` so it stretches BACKWARD into the drawn
            portion rather than forward into the undrawn one, a head that
            overshot the fill would be reporting progress that has not happened.

            ⚠️ IT MUST COUNTER-SCALE. The parent is scaled on Y by up to 1.0, so
            an unscaled child inherits that and would be squashed to nothing at
            low progress and stretched at high. Dividing by the parent's scale
            keeps the head a constant 40px on screen regardless of how full the
            rail is. Without this the effect silently becomes "the head grows as
            you read", which is a different and wrong statement.
          */}
          <m.span
            data-fm-head
            style={{
              position: "absolute",
              insetInline: 0,
              bottom: 0,
              height: HEAD,
              transformOrigin: "bottom",
              background: "var(--primary)",
              filter: "blur(1px)",
              scaleY: headCounterScale,
              opacity: headOpacity,
            }}
          />
        </m.span>
      </span>

      {/*
        THE LIST ITSELF, AND IT MUST BE RENDERED ON BOTH BRANCHES.

        An earlier revision returned only the rail here, which dropped every role
        row on any viewport wide enough to take the animated branch, the content
        the rail exists to annotate, gone, on the primary case. It is the exact
        failure ../sections.ts:33-59 is written to prevent, arrived at from the
        other direction: not a from-state left behind, but markup a branch forgot
        to render.

        `.thread-steps` carries the stepped indentation from styles/globals.css.
        It has to be on this <ul> as well as on the one in the branch above, or
        the rows lose their indent exactly when the rail is there to measure them.
      */}
      <ul ref={listRef} className="depth-stage thread-steps space-y-5">
        {children}
      </ul>
    </FmRoot>
  )
}
