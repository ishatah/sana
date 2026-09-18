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
 * class strings have to come from one place, inlining them twice is how the two
 * halves of a nav quietly drift apart.
 *
 * ACTIVE STATE IS THE COOL TONE, NOT GOLD.
 *
 * "Which page am I on" is wayfinding, which is what --accent-cool exists to
 * carry, see the split documented on that token in styles/globals.css. The nav
 * is also on screen on every route, so leaving it gold meant the accent's most
 * persistent appearance on the site was a navigation state rather than anything
 * the page wanted emphasised.
 *
 * The inactive hover stays neutral (--heading) rather than tinting: a hue change
 * on hover plus a hue change on active gives two different colours for two
 * different states in a six-item row, which reads as noise.
 */
function desktopLinkClass(isActive: boolean): string {
  /*
   * `.masthead-link` carries only the RTL tracking reset (see globals.css); the
   * size and spacing stay here with the rest of the link's appearance. The
   * tracking is 0.14em rather than the old row's 0.15em, matching `.eyebrow`,
   * because in a centred masthead this row IS an eyebrow: a line of small caps
   * labelling what is above it.
   */
  return `masthead-link relative font-display text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
    isActive
      ? "text-[color:var(--accent-cool)]"
      : "text-[color:var(--foreground)] hover:text-[color:var(--heading)]"
  }`
}

function mobileLinkClass(isActive: boolean): string {
  return `font-display text-2xl font-bold uppercase tracking-wide transition-colors ${
    isActive
      ? "text-[color:var(--accent-cool)]"
      : "text-[color:var(--heading)] hover:text-[color:var(--accent-cool)]"
  }`
}

/**
 * THE EDITORIAL MASTHEAD: the wordmark centred on its own line, a hairline
 * beneath it, the nav row centred below that, and the header's own border
 * closing the block.
 *
 * ── IT HAS TWO HEIGHTS, BOTH OF THEM CONSTANTS ────────────────────────────────
 *
 * At rest it is --masthead-tall; once scrolled past 60px it collapses to
 * --masthead-short, the wordmark shrinking onto the same row as the links and
 * the inner rule retreating to nothing. The tokens and the reasoning behind
 * keeping them as two fixed values rather than one animated one are in
 * styles/globals.css; the short version is that `scroll-padding-block-start`
 * needs a height it can resolve, and a value mid-transition is not one.
 *
 * THE SWITCH IS AN ATTRIBUTE ON `body`, NOT A CLASS ON THIS ELEMENT. The anchor
 * offset is declared on `html`, an ancestor of this header, and custom
 * properties inherit downward only, so a token set here would be invisible to
 * the rule that needs it. `body` is the lowest element both can see. That is
 * also why this component writes to the DOM directly in an effect rather than
 * rendering the attribute: `body` is outside React's tree.
 *
 * ── WHAT IS UNCHANGED ─────────────────────────────────────────────────────────
 *
 * The scrolled background swap, the scroll-spy, the sliding underline, the
 * mobile overlay and the two-kinds-of-link handling are all exactly as they
 * were. The underline in particular needs no adjustment: it measures each link's
 * rect against the nav's own rect, so a centred row is no different from a
 * right-aligned one as far as it is concerned.
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

  // `enabled:false` hides a section whose content has not been supplied, press
  // today. Filtering here rather than in the data means the anchor list and the
  // rendered sections cannot disagree.
  const visible = items.filter((i) => i.enabled)

  /**
   * Active state, derived during render rather than held in state.
   *
   * The route match has to be computed, not set in an effect: this used to
   * initialise to `items[0].id`, so opening /about highlighted "Home" until
   * hydration replaced it, a visible flash on every sub-page load. `usePathname`
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
   * Mirror the scrolled state onto `body`, where the height token lives.
   *
   * Written to the DOM rather than rendered because `body` is outside React's
   * tree. The cleanup removes the attribute so a teardown cannot leave the
   * document pinned to the collapsed height with no header driving it.
   */
  useEffect(() => {
    const { body } = document
    if (scrolled) body.setAttribute("data-nav-scrolled", "")
    else body.removeAttribute("data-nav-scrolled")

    return () => body.removeAttribute("data-nav-scrolled")
  }, [scrolled])

  /**
   * The sliding underline.
   *
   * Called directly rather than through `MotionScope`, because that component
   * wraps page SECTIONS and this is the header, wrapping the nav in one would
   * mean a scope whose only purpose is to reach an element it does not own.
   * `SiteNav` is already a client component, so an effect is the natural fit and
   * the cleanup contract is identical: whatever the interaction returns is what
   * removes its listeners.
   *
   * Reduced motion is checked here, since the scope's `mediaQueries` guard is not
   * in play. Without it, a visitor who has asked for less movement still gets a
   * bar chasing the cursor across the header.
   *
   * `scrolled` IS A DEPENDENCY NOW. The collapse moves every link horizontally,
   * the row re-centres as the wordmark leaves it, so the rects the interaction
   * measured at the tall height are stale at the short one and the bar would sit
   * beside its item rather than under it. Rebinding on the transition re-measures
   * them. It is the same argument as the `resize` listener the interaction
   * already carries: the geometry changed, so the measurement has to be retaken.
   */
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const cleanup = INTERACTIONS.navUnderline(header)
    return () => cleanup?.()
    // `visible.length` rather than `visible`: the array identity changes on every
    // render, which would tear down and rebind the listeners each time.
  }, [visible.length, active, scrolled])

  /**
   * Scroll-spy for the active anchor.
   *
   * A single observer over all the sections rather than one per link. The
   * `-45% 0px -50%` root margin narrows the viewport to a band just above the
   * middle, so exactly one section qualifies at a time, without it, two adjacent
   * sections are both "intersecting" through most of a scroll and the highlight
   * flickers between them.
   */
  useEffect(() => {
    // Only fragment entries are spyable, and only on a page that actually renders
    // them. On a sub-page this resolves to nothing and the guard below bails,
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
     * THE HEIGHT IS --nav-height, WHICH IS NOW ONE OF TWO CONSTANTS.
     *
     * It reads the same token it always did; what changed is that the token is
     * reassigned on `body[data-nav-scrolled]` rather than being a single fixed
     * value. Everything downstream of it, the anchor offset on `html`, the
     * sticky ledger column, follows automatically. See the block on the tokens
     * in styles/globals.css.
     *
     * A BORDER ON SCROLL, NOT A SHADOW.
     *
     * The scrolled state used `shadow-[var(--shadow-brand)]`, which was the
     * light scheme's warm brown glow. A drop shadow works by darkening what is
     * behind it, on a charcoal page there is nothing left to darken, so it
     * contributed a faint muddy smear and no separation at all. A hairline is
     * how a fixed header separates itself from dark content.
     *
     * THE BORDER APPEARS ON SCROLL, TOGETHER WITH THE GROUND BEHIND IT.
     *
     * It was briefly permanent, on the argument that the lower rule is half of
     * the "rules above and below" the design is built on. But at the top of the
     * page the header is transparent, so that rule was a hairline ruled across
     * the hero with nothing above it, separating the hero from itself. A
     * separator needs two things to separate; at rest there is only one.
     *
     * So it fades in with the background, on the same `scrolled` flag and the
     * same duration, and the pair reads as one bar arriving rather than as a
     * line that was always there over a ground that was not. The inner masthead
     * rule under the wordmark is untouched: that one underscores the name, which
     * IS present at rest, so it has something to do.
     *
     * `border-transparent` rather than `border-b-0`: the border box has to keep
     * its width or the header's content shifts up a pixel as it fades in, and
     * `border-color` is animatable where border-width is not.
     *
     * AND THAT GROUND IS OPAQUE, NOT FROSTED. The scrolled state was
     * `bg-[--background]/95 backdrop-blur-sm`. At 95% opacity the blur had
     * almost nothing to act on, 5% of the content bleeding through, softened,
     * so it read as a flat bar either way while still forcing the browser to
     * hold a backdrop layer and re-filter it on every scroll frame.
     *
     * Paying a compositing cost for an effect nobody can see is the easy half of
     * the argument. The other half is that frosted glass is a borrowed idiom: it
     * belongs to floating translucent panels, and this header is neither, it is
     * an opaque bar with a hairline under it, which is what the rest of the page
     * is built from.
     */
    <header
      ref={headerRef}
      style={{ height: "var(--nav-height)" }}
      className={`fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,height] [transition-duration:var(--dur-4)] [transition-timing-function:var(--ease-out)] ${
        scrolled ? "border-[color:var(--border)] bg-[color:var(--background)]" : "border-transparent bg-transparent"
      }`}
    >
      {/*
        ── THE MASTHEAD, lg AND UP ─────────────────────────────────────────

        A column at rest, a row once collapsed, which is the whole layout change
        the scroll triggers. Everything else, the rule, the wordmark's size, the
        nav row's position, is a transition on one of those two states.

        `justify-center` rather than `justify-between` in the column state: a
        masthead is centred by definition, and the language toggle and CTA are
        pinned to the corners absolutely (below) rather than participating in the
        flow. Putting them in the flow is what would pull the wordmark off
        centre, which is the one thing this design cannot tolerate.
      */}
      <div className="container-page relative hidden h-full flex-col items-center justify-center lg:flex">
        {/*
          THE CORNERS: language inline-start, CTA inline-end.

          Absolutely positioned so they take no part in centring the masthead.
          `start-0`/`end-0` are the logical insets, so Arabic mirrors them
          without a second rule, and they are inside `.container-page` so they
          sit on the same gutter every other page element does.

          They keep their vertical centring in BOTH header states, `inset-y-0`
          plus `items-center`, so the collapse does not move them at all. The
          masthead rearranges; its corners are furniture.
        */}
        <div className="absolute inset-y-0 start-0 flex items-center">
          <LanguageToggle />
        </div>
        <div className="absolute inset-y-0 end-0 flex items-center">
          <Link href={contactHref} className="btn-main !px-6 !py-2.5 text-sm">
            {t("cta")}
          </Link>
        </div>

        {/*
          The wordmark. `.masthead-name` now carries the size, the tracking, the
          weight AND the case, because all four had to move together to bring it
          into line with the site's other display type; see its note in
          styles/globals.css. `font-bold uppercase` were removed from here rather
          than left to fight the rule, which is why only the colour remains.
        */}
        <a
          href="#top"
          className="masthead-name font-display text-[color:var(--heading)] transition-colors hover:text-[color:var(--primary-strong)]"
        >
          {name}
        </a>

        {/*
          THE INNER RULE, and the gap it lives in.

          `my-3` at rest, collapsing with the rule itself. It is inside a wrapper
          with `w-full max-w-[22rem]` so the rule is a measured line under the
          wordmark rather than a full-bleed divider, a masthead rule is sized to
          the name it underscores, not to the page.

          aria-hidden: it is pure typography with no semantic content, and the
          header already has its structure from the landmark and the heading.
        */}
        <span
          aria-hidden
          className={`w-full max-w-[22rem] transition-[margin] [transition-duration:var(--dur-4)] [transition-timing-function:var(--ease-out)] ${
            scrolled ? "my-0" : "my-3"
          }`}
        >
          <span className="masthead-rule block" />
        </span>

        <nav
          aria-label={t("menu")}
          className={`masthead-row relative flex items-center gap-8 ${scrolled ? "-mt-1" : ""}`}
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
                  className={`absolute -bottom-1.5 start-0 h-px bg-[color:var(--accent-cool)] transition-all [transition-duration:var(--dur-3)] [transition-timing-function:var(--ease-rule)] ${
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
      </div>

      {/*
        ── THE MOBILE BAR, BELOW lg ────────────────────────────────────────

        Unchanged. The masthead is a desktop composition; see the note on the
        `max-width` query in styles/globals.css for why the tall height is never
        in force here.
      */}
      <div className="container-page flex h-full items-center justify-between gap-6 lg:hidden">
        {/*
          The phone wordmark. It carried its own `font-bold uppercase
          tracking-[0.2em]` and so was a THIRD setting of this name, differing
          from both the desktop mark and the hero. It now takes
          `.masthead-name-compact`, which shares the case, weight and tracking of
          the desktop mark and fixes its own size.

          NOT `.masthead-name` PLUS A `text-lg` UTILITY. That was tried and the
          utility lost: `.masthead-name` is declared inside `@layer components`
          with a font-size of its own, and an unlayered Tailwind utility does not
          beat it, so the name rendered at 24px in a bar sized for 18px and wrapped
          onto two lines. Measured at 390px: 115x75px, three lines tall.
        */}
        <a
          href="#top"
          className="masthead-name-compact font-display text-[color:var(--heading)] transition-colors hover:text-[color:var(--primary-strong)]"
        >
          {name}
        </a>

        <div className="flex items-center gap-3">
          <LanguageToggle />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("menu")}
            aria-expanded={open}
            // 44x44 minimum (WCAG 2.5.5). `p-2` around a 22px icon gives 38x38,
            // and this is the only way into the menu on a phone, the one control
            // where a missed tap has nowhere to fall back to.
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-[color:var(--heading)]"
          >
            {/* CSS bars rather than an icon-library <Menu>, which renders an SVG.
                Three rules stacked IS the hamburger, it is one of the few marks
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
                  `absolute` inside a relative box so both bars share one centre,
                  stacked in flow they would sit above each other and rotate about
                  two different points.

                  THE TRANSFORM IS INLINE RATHER THAN `-translate-y-1/2 rotate-45`.
                  Those two utilities compose through Tailwind's transform custom
                  properties, and measured here the pair resolved to
                  `transform: none`, so both bars sat unrotated on top of each
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
