"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { LanguageToggle } from "@/components/LanguageToggle"
import { INTERACTIONS } from "@/components/motion/interactions"
import { localize } from "@/lib/localize"
import { stripLocale, type ResolvedNavItem } from "@/lib/nav"

/**
 * The link classes, defined once and shared by the `<Link>` and `<a>` branches.
 *
 * Both branches render identical markup and differ only in element type, so the
 * class strings have to come from one place — inlining them twice is how the two
 * halves of a nav quietly drift apart.
 */
function desktopLinkClass(isActive: boolean): string {
  return `relative font-display text-xs font-semibold uppercase tracking-[0.15em] transition-colors ${
    isActive
      ? "text-[color:var(--primary-strong)]"
      : "text-[color:var(--foreground)] hover:text-[color:var(--heading)]"
  }`
}

function mobileLinkClass(isActive: boolean): string {
  return `font-display text-2xl font-bold uppercase tracking-wide transition-colors ${
    isActive
      ? "text-[color:var(--primary-strong)]"
      : "text-[color:var(--heading)] hover:text-[color:var(--primary-strong)]"
  }`
}

/**
 * The Kyros header: transparent over the hero, solid once scrolled, with the
 * menu collapsing to a full-screen overlay below the lg breakpoint.
 *
 * The template does this with jQuery — a scroll handler toggling `.clone` on the
 * header and a `#menu-btn` click handler. Both are reimplemented here in React so
 * there is no second source of truth for the DOM.
 *
 * IT SERVES TWO KINDS OF LINK. Most entries now point at a dedicated route
 * (/about, /roles…); `#top` is still a fragment, and the home page still
 * renders every section behind its anchor. lib/nav.ts decides which is which and
 * hands this component finished hrefs, so there is no locale or path logic here.
 */
export function SiteNav({
  items,
  name,
  contactHref = "/contact",
}: {
  items: ResolvedNavItem[]
  name: string
  /** Locale-prefixed, so the CTA does not drop a visitor out of their language. */
  contactHref?: string
}) {
  const locale = useLocale()
  const pathname = usePathname()
  const t = useTranslations("nav")
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [spyActive, setSpyActive] = useState<string>("")
  const headerRef = useRef<HTMLElement>(null)

  // `enabled:false` hides a section whose content has not been supplied — press
  // today. Filtering here rather than in the data means the anchor list and the
  // rendered sections cannot disagree.
  const visible = items.filter((i) => i.enabled)

  /**
   * Active state, derived during render rather than held in state.
   *
   * The route match has to be computed, not set in an effect: this used to
   * initialise to `items[0].id`, so opening /about highlighted "Home" until
   * hydration replaced it — a visible flash on every sub-page load. `usePathname`
   * is stable across the server and client passes, so deriving it here is correct
   * in both and there is nothing to flash.
   *
   * The scroll-spy is the fallback, for the home page where several sections
   * share one URL.
   */
  const bare = stripLocale(pathname)
  const routeActive = visible.find((i) => i.path && i.path === bare)?.id
  const active = routeActive ?? spyActive ?? visible[0]?.id ?? ""

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  /**
   * The sliding underline.
   *
   * Called directly rather than through `AnimeScope`, because that component
   * wraps page SECTIONS and this is the header — wrapping the nav in one would
   * mean a scope whose only purpose is to reach an element it does not own.
   * `SiteNav` is already a client component, so an effect is the natural fit and
   * the cleanup contract is identical: whatever the interaction returns is what
   * removes its listeners.
   *
   * Reduced motion is checked here, since the scope's `mediaQueries` guard is not
   * in play. Without it, a visitor who has asked for less movement still gets a
   * bar chasing the cursor across the header.
   */
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const cleanup = INTERACTIONS.navUnderline(header)
    return () => cleanup?.()
    // `visible.length` rather than `visible`: the array identity changes on every
    // render, which would tear down and rebind the listeners each time.
  }, [visible.length, active])

  /**
   * Scroll-spy for the active anchor.
   *
   * A single observer over all the sections rather than one per link. The
   * `-45% 0px -50%` root margin narrows the viewport to a band just above the
   * middle, so exactly one section qualifies at a time — without it, two adjacent
   * sections are both "intersecting" through most of a scroll and the highlight
   * flickers between them.
   */
  useEffect(() => {
    // Only fragment entries are spyable, and only on a page that actually renders
    // them. On a sub-page this resolves to nothing and the guard below bails —
    // which is correct, because `routeActive` is already driving the highlight
    // there. Kept rather than deleted: the home page still has #top, and the
    // one-pager still renders every section.
    const ids = visible.map((i) => i.href.replace("#", "")).filter(Boolean)
    const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null)
    if (!sections.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const match = visible.find((i) => i.href === `#${entry.target.id}`)
            if (match) setSpyActive(match.id)
          }
        }
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [visible])

  // Lock the page while the mobile overlay is open, and restore on close. Without
  // this the page behind scrolls under the overlay on iOS.
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : ""
    return () => {
      document.documentElement.style.overflow = ""
    }
  }, [open])

  // Escape closes the overlay. Expected of anything modal, and cheap.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    /*
     * FIXED HEIGHT, NOT ANIMATED PADDING.
     *
     * This used to shrink from `py-6` to `py-3` on scroll, so the header was
     * ~76px at rest and ~52px once scrolled, transitioning over 300ms between
     * them. That is harmless in a flowing document and unworkable underneath
     * scroll snapping: `scroll-padding-block-start` has to equal the header's
     * height for a snapped section to land below it rather than behind it, and a
     * height that is mid-transition has no single correct value — every snap
     * during those 300ms lands at a slightly different offset.
     *
     * The height is now --nav-height in styles/globals.css, which is the same
     * value the scroll padding reads, and only colour, shadow and blur still
     * transition. The header still visibly changes on scroll; it just no longer
     * changes SIZE.
     */
    <header
      ref={headerRef}
      style={{ height: "var(--nav-height)" }}
      /*
       * A BORDER ON SCROLL, NOT A SHADOW.
       *
       * The scrolled state used `shadow-[var(--shadow-brand)]`, which was the
       * light scheme's warm brown glow. A drop shadow works by darkening what is
       * behind it — on a charcoal page there is nothing left to darken, so it
       * contributed a faint muddy smear and no separation at all. A hairline is
       * how a fixed header separates itself from dark content.
       *
       * `border-b border-transparent` in the unscrolled state rather than no
       * border: it keeps the header's box the same height in both states, so the
       * content beneath does not shift by 1px on the first scroll.
       */
      className={`fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled
          ? "border-[color:var(--border)] bg-[color:var(--background)]/95 backdrop-blur-sm"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="container-page flex h-full items-center justify-between gap-6">
        <a
          href="#top"
          className="font-display text-lg font-bold uppercase tracking-[0.2em] text-[color:var(--heading)] transition-colors hover:text-[color:var(--primary-strong)]"
        >
          {name}
        </a>

        <nav
          aria-label={t("menu")}
          className="relative hidden items-center gap-8 lg:flex"
          data-interact="nav-list"
        >
          {/* One shared underline that slides between items. Hidden until the
              interaction claims it; the per-item spans below stay as the no-JS
              and reduced-motion indicator. */}
          <span aria-hidden className="nav-underline" data-interact="nav-bar" />

          {visible.map((item) => {
            const isActive = active === item.id
            const inner = (
              <>
                {localize(item.label, locale)}
                <span
                  className={`absolute -bottom-1.5 start-0 h-px bg-[color:var(--primary)] transition-all duration-300 ${
                    isActive ? "w-full" : "w-0"
                  }`}
                />
              </>
            )
            const props = {
              className: desktopLinkClass(isActive),
              "aria-current": isActive ? ("page" as const) : undefined,
            }

            // next/link for routes so navigation stays client-side; a plain
            // anchor for fragments, because Link would push a history entry for
            // a same-document jump the browser already handles.
            return item.isRoute ? (
              <Link key={item.id} href={item.resolved} {...props}>
                {inner}
              </Link>
            ) : (
              <a key={item.id} href={item.resolved} {...props}>
                {inner}
              </a>
            )
          })}
        </nav>

        {/*
          The locale switcher and the CTA, OUTSIDE the <nav>.

          LanguageToggle used to live inside it. It is not navigation — it does not
          take you to another part of the document, it re-renders the current one
          in another language — so it was inflating the "navigation" landmark's
          contents for anyone listing links by landmark. It is its own labelled
          group (role="group" aria-label="Language") and belongs beside the nav,
          not in it.
        */}
        <div className="hidden items-center gap-4 lg:flex">
          <LanguageToggle />
          <Link href={contactHref} className="btn-main btn-pill !px-6 !py-2.5 text-sm">
            {t("cta")}
          </Link>
        </div>

        <div className="flex items-center gap-3 lg:hidden">
          <LanguageToggle />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("menu")}
            aria-expanded={open}
            // 44x44 minimum (WCAG 2.5.5). `p-2` around a 22px icon gives 38x38,
            // and this is the only way into the menu on a phone — the one control
            // where a missed tap has nowhere to fall back to.
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-[color:var(--heading)]"
          >
            {/* CSS bars rather than an icon-library <Menu>, which renders an SVG.
                Three rules stacked IS the hamburger — it is one of the few marks
                that is literally its own geometry, so nothing is approximated
                here. aria-hidden because the button already carries aria-label. */}
            <span aria-hidden className="flex h-[22px] w-[22px] flex-col justify-center gap-[5px]">
              <span className="h-[2px] w-full rounded-full bg-current" />
              <span className="h-[2px] w-full rounded-full bg-current" />
              <span className="h-[2px] w-full rounded-full bg-current" />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[color:var(--background)] lg:hidden">
          <div className="container-page flex items-center justify-between py-6">
            <span className="font-display text-lg font-bold uppercase tracking-[0.2em] text-[color:var(--heading)]">
              {name}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-[color:var(--heading)]"
            >
              {/* The same two bars rotated into a cross, replacing the <X> mark.
                  `absolute` inside a relative box so both bars share one centre —
                  stacked in flow they would sit above each other and rotate about
                  two different points.

                  THE TRANSFORM IS INLINE RATHER THAN `-translate-y-1/2 rotate-45`.
                  Those two utilities compose through Tailwind's transform custom
                  properties, and measured here the pair resolved to
                  `transform: none` — so both bars sat unrotated on top of each
                  other and the X rendered as a single horizontal line. One explicit
                  declaration cannot be half-applied, and the order matters: the
                  translate has to run before the rotate or the bar swings about its
                  own top edge rather than the box's centre. */}
              <span aria-hidden className="relative block h-[22px] w-[22px]">
                <span
                  className="absolute left-0 top-1/2 h-[2px] w-full rounded-full bg-current"
                  style={{ transform: "translateY(-50%) rotate(45deg)" }}
                />
                <span
                  className="absolute left-0 top-1/2 h-[2px] w-full rounded-full bg-current"
                  style={{ transform: "translateY(-50%) rotate(-45deg)" }}
                />
              </span>
            </button>
          </div>
          <nav aria-label={t("menu")} className="container-page flex flex-1 flex-col justify-center gap-6">
            {visible.map((item) => {
              const isActive = active === item.id
              const props = {
                onClick: () => setOpen(false),
                className: mobileLinkClass(isActive),
                "aria-current": isActive ? ("page" as const) : undefined,
              }

              return item.isRoute ? (
                <Link key={item.id} href={item.resolved} {...props}>
                  {localize(item.label, locale)}
                </Link>
              ) : (
                <a key={item.id} href={item.resolved} {...props}>
                  {localize(item.label, locale)}
                </a>
              )
            })}
          </nav>
        </div>
      )}
    </header>
  )
}
