"use client"

import { useEffect, useRef } from "react"
import { INTERACTIONS, type InteractionName } from "./interactions"
import { mountSection, type RecipeName } from "./sections"
import { useSectionSkew } from "./fm/use-section-skew"

/**
 * The single client boundary for the input-driven interaction layer.
 *
 * IT CARRIES INTERACTIONS ONLY, hover rules, expanding rows, copy-to-clipboard,
 * the enquiry prefill and the nav underline. Two of those (`copyEmail`,
 * `prefillEnquiry`) are functionality rather than decoration, which is why this
 * boundary exists at all.
 *
 * Every section that needs one of those behaviours wraps its markup in one of
 * these. The markup itself stays a SERVER component, it arrives here as
 * `children`, already rendered, and is passed straight through. That is what keeps
 * the data-fetching pages server-side; nothing in components/ has to become a
 * client component to gain an interaction.
 *
 * ── WHAT REPLACED anime.js's `createScope` ─────────────────────────────────────
 *
 * This used to construct an anime.js scope, which bundled three things: teardown
 * of everything created inside it, selector scoping to the subtree, and a watched
 * media query. Motion has no equivalent, and it turns out none was needed:
 *
 *   - TEARDOWN was never actually the scope's doing. Every interaction in
 *     ./interactions.ts already returns its own cleanup, that is the contract
 *     stated at the top of that file, and now also cancels its in-flight
 *     animations through `listeners().track`. This component just calls it.
 *   - SELECTOR SCOPING was never the scope's doing either. Each interaction
 *     receives `root` and queries from it with `root.querySelectorAll`, so an
 *     interaction written for one section already cannot reach into another.
 *   - THE MEDIA QUERY is the one thing worth keeping, and it is three lines of
 *     `matchMedia`, the same three lines ./hero-scope.tsx already runs.
 *
 * ── AND THE SWAP FIXED A BUG WORTH NAMING ──────────────────────────────────────
 *
 * The old scope read `self.matches.reduced` ONCE, when the scope was constructed.
 * A visitor who turned reduced-motion off after the page had loaded stayed in the
 * reduced branch until they navigated, and because the guard returned before any
 * interaction was registered, that meant no copy button and no enquiry prefill
 * for the rest of the visit. Those are FUNCTIONALITY, and losing them to a stale
 * media-query read is a straightforward defect.
 *
 * The listener below re-runs on every change, mounting and tearing down as the
 * preference moves. Unlike the hero's entrance, which deliberately never replays,
 * because animating content the visitor has already read is worse than not
 * animating it, there is nothing to replay here: an interaction is a set of
 * listeners waiting for input, so mounting it late costs nothing and is simply
 * correct.
 *
 * A reduced-motion visitor still falls back to the plain `mailto:` link and the
 * form beneath it, both of which are in the server-rendered markup for exactly
 * this reason.
 */
export function MotionScope({
  interaction,
  recipe,
  physics,
  children,
  className,
  id,
  as: Tag = "div",
  ...rest
}: {
  /**
   * An input-driven behaviour from ./interactions.
   *
   * It owns the scope rather than getting its own effect for one reason: every
   * interaction registers event listeners, and `scope.revert()` is what removes
   * them. A second lifecycle would mean a second teardown path to keep correct,
   * and a missed one leaks a listener set on every client-side navigation between
   * these five pages.
   *
   * It also inherits the reduced-motion guard, see the note above on what that
   * means for the two interactions that are functionality rather than motion.
   */
  /*
   * ONE NAME OR SEVERAL. A section is not limited to a single behaviour: the
   * Roles band wants BOTH the hover mark (`ledgerMarks`) and the verification
   * draw (`verifyMarks`), which a single-name prop made unreachable, the
   * homepage silently got the hover and lost the mark that carries the
   * information. Each name is mounted and torn down independently, so an array
   * is exactly N of the single case and never a new code path.
   */
  interaction?: InteractionName | InteractionName[]
  /**
   * A section entrance + its scroll-linked effects, from ./sections.
   *
   * IT GETS ITS OWN EFFECT RATHER THAN SHARING THE INTERACTION'S, and the two
   * never touch. An interaction is a set of listeners that should mount and
   * unmount freely as the reduced-motion preference changes; an entrance is a
   * one-time event that must NOT replay on content the reader has already passed.
   * Those are different lifecycles, so they get different `useEffect`s with
   * different latching rules, see the note on each below.
   *
   * Sections that want only an entrance pass `recipe` alone; sections that want
   * only an interaction pass `interaction` alone; the About and Roles bands want
   * both and pass both, on one element rather than two nested wrappers.
   */
  recipe?: RecipeName
  /**
   * A12, VELOCITY SKEW. The band leans on the block axis in proportion to scroll
   * velocity and springs back to flat the moment the reader stops.
   *
   * ── WHY IT IS A PROP HERE RATHER THAN A WRAPPER COMPONENT ────────────────────
   *
   * A `<ScrollPhysics>` wrapper would add a DOM element around every section and a
   * second client boundary inside a component that is already one. This element is
   * the section, and this component is already "use client", so the skew costs a
   * hook, not a node.
   *
   * It also means the effect can never be applied to the WRONG element. The skew
   * writes `transform` on the band; if it were a wrapper, a caller could nest it
   * inside the section and shear the content rather than the band, which reads as
   * a rendering fault rather than as a gesture.
   *
   * ── AND WHY IT DOES NOT COLLIDE WITH `recipe` ───────────────────────────────
   *
   * ./fm/variants.ts states the rule that makes this safe: ONE EFFECT PER ELEMENT.
   * The recipes write `transform` on `[data-anime]` hooks INSIDE the band, the
   * headings, the panels, the rows, and this writes `transform` on the band
   * ITSELF. Parent and child are different nodes, so the two compose rather than
   * race, which is exactly the arrangement ./fm/expertise-card.tsx describes for
   * the <li> and the card nested in it.
   *
   * The band must therefore never carry a `data-anime` hook of its own. None does
   * today, every recipe queries descendants, and the dev audit in ./fm/audit.tsx
   * asserts the boundary the rule depends on.
   */
  physics?: boolean
  children: React.ReactNode
  className?: string
  id?: string
  as?: React.ElementType
  /**
   * Anything else, any `data-*` a caller needs on the rendered element.
   *
   * WITHOUT THIS SPREAD THE ATTRIBUTE IS SILENTLY DROPPED, and this component had
   * exactly that bug: it destructured its known props and rendered only those, so
   * a `data-*` passed by a caller never reached the DOM, no error, just an
   * attribute that quietly did not exist. `Reveal` carries the same note.
   */
  [key: string]: unknown
}) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el || !interaction) return

    const names = Array.isArray(interaction) ? interaction : [interaction]
    if (!names.length) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let teardown: Array<() => void> | undefined

    const sync = () => {
      if (reduced.matches) {
        teardown?.forEach((off) => off())
        teardown = undefined
        return
      }
      // Already mounted, a `change` that did not cross the threshold.
      if (teardown) return
      teardown = names
        .map((name) => INTERACTIONS[name](el))
        .filter((cleanup): cleanup is () => void => typeof cleanup === "function")
    }

    sync()
    reduced.addEventListener("change", sync)

    /*
     * ── THE SAME RE-BIND THE ENTRANCE EFFECT BELOW NEEDS, AND WHY ────────────
     *
     * An interaction binds listeners to the nodes it finds when this effect
     * runs. A client component that re-renders its children DETACHES those
     * nodes, and the listeners go with them, the markup left in the DOM looks
     * identical and responds to nothing.
     *
     * This was a live defect, not a hypothetical: `prefillEnquiry` is bound on
     * the Working Together band, whose rows are re-rendered by `PinnedLedger`
     * above `md`. Every one of the four "Start an enquiry" rows was inert on
     * desktop, clicking one filled nothing and scrolled nowhere. It failed
     * silently because a <button> that does nothing looks exactly like a button
     * whose handler ran, and the section's own hover styling still worked, since
     * that is pure CSS.
     *
     * Re-binding on a structural change is the general fix. Interactions are
     * idempotent by construction, each returns a cleanup that removes exactly
     * what it added, so tearing down and re-running is always safe.
     */
    let pending: number | undefined
    const observer = new MutationObserver((records) => {
      const structural = records.some((r) => r.addedNodes.length || r.removedNodes.length)
      if (!structural || reduced.matches) return

      if (pending !== undefined) cancelAnimationFrame(pending)
      pending = requestAnimationFrame(() => {
        pending = undefined
        teardown?.forEach((off) => off())
        teardown = undefined
        sync()
      })
    })

    observer.observe(el, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (pending !== undefined) cancelAnimationFrame(pending)
      reduced.removeEventListener("change", sync)
      teardown?.forEach((off) => off())
    }
    /*
     * An ARRAY LITERAL PROP WOULD RE-RUN THIS EVERY RENDER, a new identity each
     * time, so every interaction would tear down and remount. Joining to a
     * string keys the effect on what the names ARE rather than on the array's
     * identity, which is what callers mean when they write the list inline.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(interaction) ? interaction.join(",") : interaction])

  /*
   * The entrance layer, deliberately in its OWN effect.
   *
   * The difference from the interaction effect above is the `mounted` latch, and
   * what it latches is the MOUNT, not the animation. A visitor who turns
   * reduced-motion OFF halfway down the page should not have the section's motion
   * armed underneath them mid-read; turning it ON still tears it down immediately.
   *
   * It is NOT what makes an entrance play once, and nothing does any more. Once
   * mounted, ./sections.ts replays the entrance on every arrival and re-arms it on
   * every departure, see `entrance` there and `inViewRepeat` in ./scroll.ts.
   *
   * The interaction effect has no such latch, because mounting a listener late
   * costs nothing and is simply correct.
   */
  useEffect(() => {
    const el = root.current
    if (!el || !recipe) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let teardown: (() => void) | undefined
    let mounted = false

    const sync = () => {
      if (reduced.matches) {
        teardown?.()
        teardown = undefined
        return
      }
      if (mounted) return
      mounted = true
      teardown = mountSection(el, recipe)
    }

    sync()
    reduced.addEventListener("change", sync)

    /*
     * ── THE RE-MOUNT, AND THE BUG THAT MADE IT NECESSARY ─────────────────────
     *
     * A recipe queries `[data-anime]` ONCE, when this effect runs, and holds the
     * element references it found. That is correct for a band whose markup is
     * server-rendered and then left alone, which was every band when the
     * recipes were written.
     *
     * It is wrong for a band containing a client component that REPLACES its
     * children on mount. `PinnedLedger` does exactly that: above `md` it re-
     * renders the rows inside `<m.li>` wrappers, so every node `aboutSpread` had
     * captured was detached a moment later. The recipe went on animating
     * orphans, and the Working Together band, the one section on the homepage
     * built this way, silently had no entrance at all. Its rows, its statement
     * and its hairlines all sat at their resting state while every other band
     * animated, which is the "these sections don't have enough animation"
     * report this change answers.
     *
     * A MutationObserver on the subtree is the general fix: whatever swaps the
     * children, the recipe is torn down and re-run against what is actually in
     * the DOM now. It is debounced to a microtask-plus-frame so a component that
     * replaces several children does one remount rather than one per node.
     *
     * `mounted` is reset before re-running, because `sync` is what owns the
     * latch and it would otherwise refuse the second mount.
     */
    let pending: number | undefined
    const observer = new MutationObserver((records) => {
      // Only a change to the HOOKS matters. Ignoring attribute-only mutations is
      // what stops this from re-entering: every recipe writes inline styles to
      // the hooks it animates, and observing those would remount on its own
      // output, forever.
      const structural = records.some((r) => r.addedNodes.length || r.removedNodes.length)
      if (!structural || reduced.matches) return

      if (pending !== undefined) cancelAnimationFrame(pending)
      pending = requestAnimationFrame(() => {
        pending = undefined
        teardown?.()
        mounted = false
        sync()
      })
    })

    observer.observe(el, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (pending !== undefined) cancelAnimationFrame(pending)
      reduced.removeEventListener("change", sync)
      teardown?.()
    }
  }, [recipe])

  /*
   * The hook is called UNCONDITIONALLY and branches on `physics` internally,
   * never `physics && useSectionSkew()`, which would change hook order between
   * renders the moment a caller toggled the prop. That is the same discipline
   * ./fm/use-entrance.ts states as "branch OUTPUT RANGES on this, never hook
   * order", applied one level up.
   */
  const skewStyle = useSectionSkew(Boolean(physics))

  return (
    <Tag ref={root} id={id} className={className} style={skewStyle} {...rest}>
      {children}
    </Tag>
  )
}
