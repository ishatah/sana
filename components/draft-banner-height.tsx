"use client"

import { useEffect } from "react"

/**
 * Publishes the draft banner's REAL rendered height as `--draft-banner-height`.
 *
 * WHY THIS IS MEASURED RATHER THAN DECLARED. The header and the hero both offset
 * themselves by that variable, and the banner's height is not knowable in CSS:
 *
 *   - the notice wraps to one, two or three lines depending on viewport width
 *   - each locale wraps differently — the Turkish and Arabic notices are longer
 *     than the English one and break at different points
 *   - The body face's line box differs between Latin and Arabic script
 *
 * The first attempt at this used a fixed 3rem with `overflow-hidden`, which
 * truncated the notice mid-sentence on a phone. The second used a breakpoint with
 * a hardcoded multiplier, which under-measured (88.8px against a real 103px) and
 * let the header overlap the banner. Both failed the same way: they guessed a
 * height that only the browser can know.
 *
 * A ResizeObserver removes the guess. The variable is set on <html> so the
 * existing `body[data-draft-banner]` rules in styles/globals.css keep working
 * unchanged — they were always correct, they were just reading a wrong number.
 *
 * The 3rem in the stylesheet stays as the pre-hydration default: it is right for
 * the single-line desktop case, so the first paint is never wildly off, and this
 * corrects it once measured.
 */
export function DraftBannerHeight() {
  useEffect(() => {
    const banner = document.querySelector<HTMLElement>("[data-draft-banner-el]")
    if (!banner) return

    const apply = () => {
      // offsetHeight rather than getBoundingClientRect().height: the latter
      // includes any transform, and a fractional value here produces a subpixel
      // gap between the banner's bottom edge and the header's top.
      document.documentElement.style.setProperty("--draft-banner-height", `${banner.offsetHeight}px`)
    }

    apply()

    const observer = new ResizeObserver(apply)
    observer.observe(banner)

    // The banner reflows when the font finishes loading, which ResizeObserver
    // catches, and on locale change, which unmounts this component anyway.
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty("--draft-banner-height")
    }
  }, [])

  return null
}
