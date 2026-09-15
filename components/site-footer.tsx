import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { getNavigation } from "@/lib/profile-content"
import { getSiteSettings } from "@/lib/site-settings"
import { localize } from "@/lib/localize"
import { routing } from "@/i18n/routing"
import { MotionScope } from "@/components/motion/motion-scope"

/**
 * The footer. Copyright line, legal links, and a social rail.
 *
 * The social rail renders nothing today and that is correct: intake section 13
 * records LinkedIn as "Not supplied", so `settings.social` is an empty array. The
 * template hardcodes five placeholder icons pointing at "#", five dead links on
 * a profile whose entire purpose is credibility. An absent rail is better than a
 * broken one, so the block is conditional on there being something real in it.
 *
 * ── THE ENTRANCE IS ON THE INNER ROW, NOT ON THE `<footer>` ───────────────────
 *
 * `<footer>` carries the top border that closes the page. Animating it would fade
 * in the rule that terminates the document. The border stays static and the
 * CONTENT inside it arrives.
 */
export async function SiteFooter() {
  const [settings, navigation] = await Promise.all([getSiteSettings(), getNavigation()])
  const locale = await getLocale()
  const t = await getTranslations("footer")

  const social = (settings.social ?? []) as { id: string; label: string; url: string }[]
  const legal = (navigation.legal ?? []) as { id: string; href: string; label: any }[]

  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`

  /*
      EFFECTS 24 AND 18, the page darkens and cools as it ends.

      `footer-sink` ramps --background down to #050506. That direction is what
      makes it free of contrast risk: #050506 is BELOW every ground in the
      ladder, so every text token measures HIGHER on it than on --background,
      the footer's --muted-foreground rises from 5.83:1 to about 6.2:1. A
      darkening gradient on a dark scheme can only improve contrast, which is why
      this one needed no per-token recomputation.

      `footer-bloom` is the cool counterweight to the hero's gold: the page opens
      warm and closes cool, which is the palette's own gold/cool split applied to
      the vertical axis of the document rather than to a component.

      `relative` is added because the bloom is an absolutely-positioned child and
      would otherwise escape to the nearest positioned ancestor.
  */
  return (
    <MotionScope as="footer" recipe="proseArrival" className="footer-sink relative border-t border-[color:var(--border)] py-10">
      {/*
        ── THE FOOTER IS NOT SCROLL-SCRUBBED, AND THAT IS A MEASURED DECISION ────

        A `ScrollReveal` was tried here first and removed. Every scroll-scrubbed
        window is keyed to where the element sits in the VIEWPORT, and the last
        element in the document never travels through one: the page stops
        scrolling while the footer is still at the bottom of the screen. Measured
        at 1440x900 with the page scrolled as far as it goes, the footer's top edge
        rests at y=824 of 900 and it attains a maximum scroll progress of ~0.35.

        Two windows were tried against that ceiling. The default (`"end 80%"`) left
        it parked at opacity 0.86; measuring to the top edge (`"start 60%"`) left it
        at 0.54. Both are the same failure, a permanently half-faded copyright
        line and legal links, on every route, and lowering the plateau far enough
        to clear it would make the reveal invisible everywhere else on the site.

        So the footer gets an ENTRANCE instead of a scrub: the vanilla
        `proseArrival` recipe plays once on arrival and settles at full opacity,
        with the 2000ms deadline in components/motion/sections.ts as its floor and
        no client boundary of its own. It is the one place on the page where
        "fire once and stay" is not a limitation, because there is nothing below it
        to scroll back up from. components/motion/fm/use-scrub-reveal.ts carries the
        general rule this is the exception to.
      */}
      {/* Effect 18's layer. It is a sibling of the content row rather than a
          wrapper, and it sits at z-index 0 with the row lifted above it, so the
          bloom can never paint over the legal links. aria-hidden because it
          carries nothing, the footer's content is entirely in the row below. */}
      <div aria-hidden className="footer-bloom" />

      <div
        data-anime="row"
        className="container-page relative z-10 flex flex-col items-center justify-between gap-6 sm:flex-row"
      >
        <p className="text-xs text-[color:var(--muted-foreground)]">
          {t("copyright", { year: new Date().getFullYear(), name: settings.siteName })}
        </p>

        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {legal.map((item) => (
            <Link
              key={item.id}
              href={`${prefix}${item.href}`}
              // The legal links are 16px tall as bare text. `py-3` lifts the hit
              // area to ~44px without moving the baseline, since the row is
              // centred and the added padding is symmetric.
              className="inline-flex min-h-[44px] items-center py-3 text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary-strong)]"
            >
              {localize(item.label, locale)}
            </Link>
          ))}
        </nav>

        {social.length > 0 && (
          <ul className="flex items-center gap-4">
            {social.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary-strong)]"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MotionScope>
  )
}
