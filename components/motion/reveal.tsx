/**
 * A plain pass-through wrapper. It no longer animates anything.
 *
 * ── WHAT THIS WAS ──────────────────────────────────────────────────────────────
 *
 * A scroll-triggered entry animation: an IntersectionObserver toggled an
 * `.is-visible` class, and until it fired the element sat at `opacity: 0` with a
 * 24px offset. That behaviour was removed along with the rest of the page's
 * scroll motion.
 *
 * ── WHY IT STILL EXISTS ────────────────────────────────────────────────────────
 *
 * Nine components render `<Reveal>`, several as `as="li"` or `as="section"` and
 * several passing `data-*` attributes through. Deleting it would mean editing
 * every one of those call sites to swap in a bare element — a large diff whose
 * only purpose is to remove a wrapper that now costs nothing. Keeping the
 * component with its signature intact removes the motion without touching the
 * markup that uses it.
 *
 * ── IT IS NO LONGER A CLIENT COMPONENT, AND THAT IS THE REAL WIN ───────────────
 *
 * The `"use client"` directive is gone. Every one of those nine call sites used to
 * pull its subtree across the client boundary purely to run the observer, so this
 * file was the reason otherwise-static markup shipped as client JavaScript. With
 * the observer gone there is no state, no effect and no reason to hydrate: the
 * wrapper renders on the server and ships nothing.
 *
 * `delay` and `once` are accepted and ignored. They are kept in the signature so
 * the existing call sites — which still pass `delay={120}` and similar — keep
 * type-checking; removing them would be the same wide diff this file exists to
 * avoid. They are deliberately not destructured into the DOM, because `delay` and
 * `once` are not valid HTML attributes and React would warn on every one.
 */
export function Reveal({
  children,
  delay: _delay = 0,
  className = "",
  as: Tag = "div",
  once: _once = true,
  ...rest
}: {
  children: React.ReactNode
  /** Accepted and ignored — see the note above. */
  delay?: number
  className?: string
  as?: React.ElementType
  /** Accepted and ignored — see the note above. */
  once?: boolean
  /**
   * Anything else — in practice `data-anime="…"`, which the remaining anime.js
   * INTERACTIONS (hover, expand, copy) still select on.
   *
   * WITHOUT THIS SPREAD THE ATTRIBUTE IS SILENTLY DROPPED. This component once
   * destructured its known props and rendered only those, so a `data-anime`
   * passed to `<Reveal as="li">` never reached the DOM and the recipes matched
   * zero elements — no error, just nothing happening. The spread stays for the
   * same reason it was added.
   */
  [key: string]: unknown
}) {
  /*
   * `.reveal` is still applied, and the class is still declared in
   * styles/globals.css — but it now resolves to the VISIBLE state
   * unconditionally. Keeping the class on the element means the stylesheet stays
   * the single place that decides what it means, rather than the truth being
   * split between a class here and a rule there.
   */
  return (
    <Tag className={`reveal ${className}`} {...rest}>
      {children}
    </Tag>
  )
}
