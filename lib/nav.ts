import { routing } from "@/i18n/routing"
import type { LocalizedString } from "@/lib/localize"

/**
 * One place where a nav entry becomes a real href.
 *
 * Before this, href resolution lived in two components that disagreed:
 * components/legal/legal-page.tsx built Turkish links as `/${""}${href}` after
 * comparing against the string literal `"tr"`, while components/site-footer.tsx
 * used `locale === routing.defaultLocale ? "" : "/" + locale`. Both happened to
 * produce working URLs, but only the second stays correct if the default locale
 * ever changes, and a hardcoded `"tr"` is exactly the kind of thing that is
 * missed on that day. The footer's form is the one kept here.
 */

export interface NavItem {
  id: string
  /** The home-page fragment, e.g. `#section-about`. Always present. */
  href: string
  /** The dedicated route, e.g. `/about`. Absent for anchor-only entries. */
  path?: string
  kind?: "anchor" | "page" | "both"
  label: LocalizedString
  enabled: boolean
}

export interface ResolvedNavItem extends NavItem {
  /** The final href for the current locale. */
  resolved: string
  /** True when this should navigate via next/link rather than jump to a fragment. */
  isRoute: boolean
}

/** `""` for the default locale (which is unprefixed), `/en` or `/ar` otherwise. */
export function localePrefix(locale: string): string {
  return locale === routing.defaultLocale ? "" : `/${locale}`
}

/**
 * Resolve every nav entry for one locale.
 *
 * An item with a `path` becomes a route link; everything else stays a fragment,
 * but an ABSOLUTE one, `/#top` rather than `#top`. That matters on a sub-page:
 * a bare `#top` on /about points at an element that does not exist there and the
 * click silently does nothing, which is the bug the legal shell was working
 * around locally. Resolving against the locale root means the same item works
 * from every page.
 */
export function resolveNavItems(items: NavItem[], locale: string): ResolvedNavItem[] {
  const prefix = localePrefix(locale)

  return items.map((item) => {
    if (item.path) {
      return { ...item, resolved: `${prefix}${item.path}`, isRoute: true }
    }
    // `prefix || "/"` because the Turkish prefix is "", and "" + "#top" is a
    // same-page fragment rather than a link to the home page.
    return { ...item, resolved: `${prefix || "/"}${item.href}`, isRoute: false }
  })
}

/**
 * Strip the locale segment from a pathname so route matching is locale-agnostic:
 * `/en/about` and `/about` both reduce to `/about`.
 *
 * Used for the nav's active state. Kept here rather than in the component so the
 * locale list comes from routing config instead of a second hardcoded list.
 */
export function stripLocale(pathname: string): string {
  const stripped = pathname.replace(new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`), "")
  return stripped || "/"
}
