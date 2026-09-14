"use client"

import { useEffect, useRef } from "react"
import { createScope } from "animejs"
import { INTERACTIONS, type InteractionName } from "./interactions"

/**
 * The single client boundary for anime.js.
 *
 * IT NOW CARRIES INTERACTIONS ONLY. The `recipe` prop and the scroll-triggered
 * entrance animations behind it have been removed; what is left is the
 * input-driven layer — hover rules, expanding rows, copy-to-clipboard and the
 * enquiry prefill. Two of those (`copyEmail`, `prefillEnquiry`) are functionality
 * rather than decoration, which is why this boundary still exists at all.
 *
 * Every section that needs one of those behaviours wraps its markup in one of
 * these. The markup itself stays a SERVER component — it arrives here as
 * `children`, already rendered, and is passed straight through. That is what keeps
 * the data-fetching pages server-side; nothing in components/ has to become a
 * client component to gain an interaction.
 *
 * WHY `createScope` RATHER THAN BARE `animate()` CALLS:
 *
 *   - `scope.revert()` tears down every listener and animation made inside it.
 *     Without that, navigating between these pages would leak the event listeners
 *     each interaction registers, once per visit.
 *   - `root` scopes every selector to this subtree, so an interaction written for
 *     one section cannot reach into another that uses the same attribute.
 *   - `mediaQueries` is evaluated by the scope and re-evaluated when the query
 *     changes, so a visitor toggling reduced-motion gets the right behaviour
 *     without a reload.
 *
 * REDUCED MOTION RETURNS BEFORE ANY INSTANCE IS CONSTRUCTED. Nothing is created at
 * all, so there is no rAF loop and no listener. Note what this now means for the
 * two FUNCTIONAL interactions: a reduced-motion visitor does not get the copy
 * button or the enquiry prefill, and falls back to the plain `mailto:` link and
 * the form beneath them — both of which are present in the server-rendered markup
 * for exactly this reason. The key name is ours: anime.js has no reserved
 * reduced-motion key, it just tracks whatever queries it is given and exposes them
 * on `self.matches`.
 */
export function AnimeScope({
  interaction,
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
   * It also inherits the reduced-motion guard — see the note above on what that
   * means for the two interactions that are functionality rather than motion.
   */
  interaction?: InteractionName
  children: React.ReactNode
  className?: string
  id?: string
  as?: React.ElementType
  /**
   * Anything else — any `data-*` a caller needs on the rendered element.
   *
   * WITHOUT THIS SPREAD THE ATTRIBUTE IS SILENTLY DROPPED, and this component had
   * exactly that bug: it destructured its known props and rendered only those, so
   * a `data-*` passed by a caller never reached the DOM — no error, just an
   * attribute that quietly did not exist. `Reveal` carries the same note.
   */
  [key: string]: unknown
}) {
  const root = useRef<HTMLElement>(null)
  const scope = useRef<{ revert: () => void } | null>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return

    // `self` is deliberately NOT annotated: anime.js exports its own
    // ScopeConstructorCallback type, and a hand-written shape for it fails to
    // assign. Letting it infer keeps `self.matches` correctly typed from the
    // library, and `reduced` is the key declared in `mediaQueries` just above.
    scope.current = createScope({
      root: root as never,
      mediaQueries: { reduced: "(prefers-reduced-motion: reduce)" },
    }).add((self) => {
      // anime.js types the callback parameter as optional, so this is guarded
      // rather than asserted. Bailing when it is absent is also the correct
      // behaviour: without `self` there is no way to read the reduced-motion
      // match, and running the animation anyway would ignore that preference.
      if (!self || self.matches.reduced) return

      const cleanups = [interaction ? INTERACTIONS[interaction](el) : undefined].filter(
        (fn): fn is () => void => typeof fn === "function",
      )

      // One combined cleanup: anime.js calls whatever the constructor returns,
      // and returning an array would silently drop both.
      return cleanups.length ? () => cleanups.forEach((fn) => fn()) : undefined
    }) as never

    return () => {
      scope.current?.revert()
      scope.current = null
    }
  }, [interaction])

  return (
    <Tag ref={root} id={id} className={className} {...rest}>
      {children}
    </Tag>
  )
}
