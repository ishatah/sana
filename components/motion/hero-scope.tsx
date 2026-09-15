"use client"

import { useEffect, useRef } from "react"
import { mountHero } from "./hero"

/**
 * The hero's client boundary.
 *
 * It wraps the hero markup rather than replacing it: `Hero` stays a SERVER
 * component and arrives here as `children`, already rendered. Nothing about the
 * hero's content, which runs `localize` across three locales, is shipped to the
 * browser to be re-rendered. This component adds one effect and no markup of its
 * own beyond the wrapper element.
 *
 * WHY NOT `MotionScope`. That component exists for the INTERACTION layer: it takes a
 * named interaction, scopes it, and tears it down on navigation. The hero's motion
 * is a one-shot entrance plus a pointer handler, which is a different lifecycle,
 * and routing it through the interactions registry would have meant adding an
 * entrance recipe back to a registry the last change deliberately emptied.
 *
 * ── REDUCED MOTION IS CHECKED HERE, AND CHECKED FIRST ──────────────────────────
 *
 * `mountHero` is never called when the visitor has asked for less motion. Not
 * "called and shortened to zero", not called at all, so no from-state is ever
 * written, no pointer listener is bound, and the role line never changes. The
 * server-rendered hero is already the finished state, so returning early leaves a
 * complete, readable, correct page.
 *
 * The query is WATCHED rather than sampled once. Someone toggling the OS setting
 * gets the change immediately: turning it on tears the motion down mid-flight,
 * turning it off does not retroactively play an entrance they have already read
 * past, `mounted` guards that, because an entrance animation firing on content the
 * visitor is already looking at is worse than no entrance at all.
 */
export function HeroScope({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let teardown: (() => void) | undefined
    let mounted = false

    const sync = () => {
      if (reduced.matches) {
        teardown?.()
        teardown = undefined
        return
      }
      // Only ever mount once per page visit. See the docblock: replaying an
      // entrance on a preference change would animate content already read.
      if (mounted) return
      mounted = true
      teardown = mountHero(el)
    }

    sync()
    reduced.addEventListener("change", sync)

    return () => {
      reduced.removeEventListener("change", sync)
      teardown?.()
    }
  }, [])

  return <div ref={root}>{children}</div>
}
