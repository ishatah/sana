import type { MetadataRoute } from "next"
import { getSiteSettings } from "@/lib/site-settings"
import { isIndexable } from "@/lib/seo"

/**
 * Robots policy.
 *
 * Default is a full disallow, and that is the correct default for this project
 * rather than a placeholder: the intake form's FINAL CHECK says nothing is
 * published until sections 15 and 18 are both complete, and section 18 is blank.
 * Titles like "Peace Ambassador for Türkiye" indexed against her name before
 * anyone has confirmed them in writing are hard to retract — a search engine keeps
 * a copy long after the page changes.
 *
 * /admin is disallowed either way. It is behind auth, but there is no reason for
 * an editor URL to be crawled at all.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const [settings, indexable] = await Promise.all([getSiteSettings(), isIndexable()])

  if (!indexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] }
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: `${settings.siteUrl}/sitemap.xml`,
  }
}
