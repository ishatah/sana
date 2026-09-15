import { getLocale } from "next-intl/server"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { MotionAudit } from "@/components/motion/fm/audit"
import { getIdentity, getNavigation } from "@/lib/profile-content"
import { resolveNavItems, localePrefix } from "@/lib/nav"

/**
 * The chrome every page that is not the home one-pager wears: nav, main, footer.
 *
 * This was `LegalPage`, which was generic sub-page furniture wearing a
 * legal-specific name, it fetched identity and navigation, resolved the nav
 * hrefs, and cleared the fixed header. All five of the new content pages need
 * exactly that, and duplicating it would mean two places to fix the next time the
 * header height or the href rules change. `LegalPage` now delegates here and
 * keeps only what is genuinely legal-specific: the prose column and the
 * "last updated" line.
 *
 * THE `pt-32` IS CONDITIONAL, and that is the whole reason `hero` is a prop
 * rather than just more children. The header is `fixed`, so a page with nothing
 * at the top would slide its first line underneath it. The legal pages pass no
 * hero and need that padding; the content pages open with a `<PageHero>` that
 * carries its own top spacing, and applying both would double it. One rule, one
 * place, and no page has to remember which case it is in.
 */
export async function PageShell({
  children,
  hero,
}: {
  children: React.ReactNode
  /** A `<PageHero>`, for pages that open with one. Omit for a plain document. */
  hero?: React.ReactNode
}) {
  const [identity, navigation] = await Promise.all([getIdentity(), getNavigation()])
  const locale = await getLocale()

  return (
    <>
      <SiteNav
        items={resolveNavItems(navigation.main ?? [], locale)}
        name={identity.nameShort}
        // `localePrefix` rather than a hand-built string, so the CTA follows the
        // same "tr is unprefixed" rule the nav links already use.
        contactHref={`${localePrefix(locale)}/contact`}
      />

      {/* `id="main"` is the skip-link target, components/skip-to-content.tsx
          points at it, so it has to be here and not on an inner wrapper. */}
      <main id="main" className={hero ? undefined : "section-pad pt-32"}>
        {hero}
        {children}
      </main>

      <SiteFooter />

      {/*
        THE DEV AUDIT NOW COVERS THESE ROUTES TOO, and that is a consequence of
        the scroll layer arriving here rather than an afterthought.

        app/[locale]/page.tsx mounted `MotionAudit` when the Framer layer existed
        only on the home page. Every route rendered through this shell now carries
        `data-fm` elements, the parallax band in `PageHero`, the band washes in
        each section, the revealed footer above, so the ownership invariant it
        checks is live here and was previously unchecked.

        It costs nothing in production: the whole body is behind a
        `NODE_ENV !== "production"` guard the bundler evaluates statically and
        dead-code-eliminates, and the component renders null either way.
      */}
      <MotionAudit />
    </>
  )
}
