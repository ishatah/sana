"use client"

import { useEffect } from "react"

import { DUR } from "./tokens"

/**
 * Development-only assertions for the two-layer motion system.
 *
 * ── WHY THESE CANNOT BE STATIC CHECKS ─────────────────────────────────────────
 *
 * scripts/check-publish-gate.mjs catches the things that are visible in source:
 * a `splitText` call, a `framer-motion` import, a `motion.*` component. It cannot
 * catch any of the invariants below, because each is a property of the RENDERED
 * TREE, and invariant 3 of the rendered tree OVER TIME, rather than of any one
 * file.
 *
 * The ownership rule in particular is violated by two files that are each
 * individually correct, a server component adding `data-anime` to an element a
 * client wrapper independently gives `data-fm` to. No amount of reading either
 * file reveals it; only the composed DOM does.
 *
 * ── WHAT IT COSTS IN PRODUCTION: NOTHING ──────────────────────────────────────
 *
 * The whole body is behind `process.env.NODE_ENV !== "production"`, which the
 * bundler evaluates statically and dead-code-eliminates. The component renders
 * null either way.
 */
export function MotionAudit() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return

    /*
     * INVARIANT 1, THE OWNERSHIP RULE.
     *
     * `data-anime` belongs to components/motion/sections.ts and hero.ts;
     * `data-fm` belongs to components/motion/fm/. An element carrying both is
     * written by two animation systems, and since ../dom.ts composes a single
     * `transform` string while Framer writes its own from MotionValues, whichever
     * runs last on a given frame wins, so the element visibly fights itself at a
     * rate that depends on scroll speed. It is the hardest class of bug here to
     * reproduce and the easiest to prevent.
     *
     * See ./variants.ts for the rule and the two nested-element fixes it forced
     * (the hero portrait and the hero role line).
     */
    const shared = document.querySelectorAll("[data-anime][data-fm]")
    if (shared.length) {
      console.error(
        `[motion audit] OWNERSHIP VIOLATION: ${shared.length} element(s) carry both ` +
          `data-anime and data-fm, so both motion layers will write them. ` +
          `Split them across a parent and a child, see components/motion/fm/variants.ts.`,
        shared,
      )
    }

    /*
     * INVARIANT 2, THE SUBJECT'S NAME IS ONE INTACT TEXT NODE.
     *
     * components/hero.tsx:302-311 is explicit that the <h1> renders a real
     * person's name and takes no animation hook at all. The risk is not that
     * someone edits that comment out; it is that a future heading animation is
     * applied globally and reaches this element too.
     *
     * Checking for ELEMENT children rather than for a specific technique catches
     * every version of the mistake, a split, a per-word wrap, a mask applied to
     * inner spans, because all of them have to put something inside the <h1>
     * first.
     */
    const name = document.querySelector('h1[data-anime="name"]')
    if (name && name.children.length > 0) {
      console.error(
        `[motion audit] THE SUBJECT'S NAME HAS BEEN SPLIT. The hero <h1> must ` +
          `contain exactly one text node and no elements, intake section 6 fixes ` +
          `the name format, and components/hero.tsx states the rule.`,
        name,
      )
    }

    /*
     * INVARIANT 3, NO HEADING IS LEFT MASKED.
     *
     * A10 uncovers section headings with a `mask-image` sweep and clears the
     * property when the sweep completes. A heading still carrying a mask once
     * everything has settled is the failure mode that matters most in this
     * codebase: `mask-image` is not covered by the `[data-anime]` reduced-motion
     * floor, and a heading stranded mid-mask is invisible text rather than an
     * unanimated heading.
     *
     * ⚠️ THE CLOCK STARTS AT EACH HEADING'S OWN SWEEP, NOT AT MOUNT.
     *
     * This check used to be a single `setTimeout(…, 4000)` on mount, reasoning
     * that 4s clears both the DUR.d6 (1.65s) sweep and the 2000ms entrance
     * deadline. That reasoning only holds for a heading ALREADY IN VIEW when the
     * page loads. ./mask-heading.tsx applies the mask on `useInView`, so a
     * heading below the fold is swept whenever the reader happens to scroll to
     * it, five seconds in, or five minutes. A single mount-time timer therefore
     * fired in the middle of a perfectly healthy sweep and reported correct
     * behaviour as invisible text, which is the worst thing an audit can do: the
     * one alarm that must be believed became the one that cries wolf.
     *
     * Timing from mount cannot be made right by choosing a larger constant,
     * there is no delay a reader cannot out-wait before scrolling. The clock has
     * to start when a given heading's sweep starts.
     *
     * A `MutationObserver` on `style` is exactly that signal. ./mask-heading.tsx
     * writes the mask inline when the sweep begins and clears it inline when the
     * sweep completes, so this observes the real transitions rather than a guess
     * about them: arm a per-heading timer when a mask appears, cancel it when the
     * mask goes. A heading is reported only if its OWN sweep began and did not
     * finish, which is the actual failure, and is now caught wherever in the
     * page's life it happens rather than only in the first four seconds.
     */
    const GRACE = 4000
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>()

    const isMasked = (h: HTMLElement) => {
      const mask = h.style.maskImage || h.style.webkitMaskImage
      return !!mask && mask !== "none"
    }

    const check = (h: HTMLElement) => {
      timers.delete(h)
      // Re-read rather than trusting the state that armed the timer: the sweep
      // may have finished, or the element may have been detached, in between.
      if (!h.isConnected || !isMasked(h)) return
      console.error(
        `[motion audit] A HEADING IS STILL MASKED ${GRACE}ms after its sweep started ` +
          `- the sweep runs for ${DUR.d6}s, so it should be long finished. This is ` +
          `invisible text. See components/motion/fm/mask-heading.tsx.`,
        h,
      )
    }

    const sync = (h: HTMLElement) => {
      const armed = timers.get(h)
      if (isMasked(h)) {
        // Already counting down, do not restart, or an animating mask (which
        // rewrites `style` every frame) would push its own deadline forever.
        if (armed) return
        timers.set(h, setTimeout(() => check(h), GRACE))
      } else if (armed) {
        // The sweep finished and cleaned up. This is the healthy path.
        clearTimeout(armed)
        timers.delete(h)
      }
    }

    const observer = new MutationObserver((records) => {
      for (const r of records) sync(r.target as HTMLElement)
    })

    for (const h of document.querySelectorAll<HTMLElement>("h2[data-fm]")) {
      observer.observe(h, { attributes: true, attributeFilter: ["style"] })
      // Catch a heading already mid-sweep when this mounts.
      sync(h)
    }

    return () => {
      observer.disconnect()
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }, [])

  return null
}
