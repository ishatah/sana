import type { MetadataRoute } from "next"
import { getSiteSettings } from "@/lib/site-settings"
import { isIndexable } from "@/lib/seo"
import { routing } from "@/i18n/routing"

// The five content pages first, then the legal routes, the order the sitemap
// lists them in is a weak relevance signal, and the profile pages are the point
// of the site. `buildMetadata({ path })` on each page emits the matching canonical
// and hreflang set, so these two lists have to stay in step.
// ⚠️ THIS LIST HAD DRIFTED FROM THE ROUTER. It carried `/positions` and
// `/recognition`, both of which were removed from app/[locale]/ (the Recognition
// page was deleted rather than left to render an empty shell, see data/awards.json),
// and it omitted `/roles`, the route that replaced them. A sitemap is an active
// request to crawl, so that was two guaranteed 404s submitted to every search
// engine and the one real appointments page left out of the index entirely.
//
// It has never shipped: the sitemap returns [] while the profile is unsigned, so
// the drift was latent rather than live. It would have gone out with the first
// signed deploy.
const ROUTES = [
  "",
  "/about",
  "/expertise",
  "/roles",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
]

/**
 * Sitemap.
 *
 * Empty while the profile is unsigned. Listing URLs in a sitemap is an active
 * request to crawl them, which would contradict the robots disallow rather than
 * merely duplicate it, and a crawler handed conflicting signals tends to resolve
 * them in the direction of indexing.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, indexable] = await Promise.all([getSiteSettings(), isIndexable()])
  if (!indexable) return []

  const base = settings.siteUrl as string

  return ROUTES.flatMap((route) =>
    routing.locales.map((locale) => ({
      url: `${base}${locale === routing.defaultLocale ? "" : `/${locale}`}${route}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: route === "" ? 1 : 0.4,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${base}${l === routing.defaultLocale ? "" : `/${l}`}${route}`]),
        ),
      },
    })),
  )
}
