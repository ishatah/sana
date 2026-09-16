import type { Metadata } from "next"
import { getSiteSettings, getDeliverables } from "@/lib/site-settings"
import { getProfileStrings, getPositions, getAwards, getExpertise } from "@/lib/profile-content"
import { getMedia } from "@/lib/media"
import { isSignedOff } from "@/lib/verification"
import { routing } from "@/i18n/routing"

/**
 * Whether search engines may index this site.
 *
 * Two independent gates, both of which must open:
 *   1. the profile has cleared the intake form's FINAL CHECK (section 18 sign-off
 *      complete AND section 15 exclusions confirmed), and
 *   2. someone has explicitly set NEXT_PUBLIC_ALLOW_INDEXING=true.
 *
 * The env flag is not redundant. Sign-off is data the admin panel can flip, and a
 * profile can be signed off for print or for LinkedIn long before anyone decides
 * the site itself should rank. Requiring a deliberate deploy-time action means
 * nobody indexes this by clicking a checkbox.
 */
export async function isIndexable(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING !== "true") return false
  const deliverables = await getDeliverables()
  return isSignedOff(deliverables.signOff)
}

export async function buildMetadata(locale: string, page?: { title?: string; description?: string; path?: string }): Promise<Metadata> {
  const [settings, profile, indexable, ogImage] = await Promise.all([
    getSiteSettings(),
    getProfileStrings(locale),
    isIndexable(),
    getMedia("og-image", locale),
  ])

  const base = settings.siteUrl as string
  const name = profile.name
  const title = page?.title ? `${page.title} | ${name}` : `${name}, ${profile.shortTitle}`

  // Meta description target is 155 characters (intake section 17). The micro bio
  // is written to 25-40 words, which lands just over that, so it is trimmed on a
  // word boundary rather than mid-name.
  const description = page?.description ?? truncate(profile.microBio, 155)

  const path = page?.path ?? ""
  const localePath = locale === routing.defaultLocale ? "" : `/${locale}`

  return {
    title,
    description,
    metadataBase: new URL(base),
    alternates: {
      canonical: `${base}${localePath}${path}`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${base}${l === routing.defaultLocale ? "" : `/${l}`}${path}`]),
      ),
    },
    robots: indexable
      ? { index: true, follow: true }
      : // Unsigned-off profile: keep it out of every index, and out of the caches
        // and snippets that survive a later robots change.
        { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    openGraph: {
      type: "profile",
      url: `${base}${localePath}${path}`,
      siteName: name,
      title,
      description,
      locale,
      // No share image is supplied (open question Q5), so the key is omitted rather
      // than pointed at a generated card carrying a name and a title that are still
      // unconfirmed, a share card is the part of an unpublished profile most likely
      // to be screenshotted and forwarded on its own.
      ...(ogImage ? { images: [{ url: ogImage.src, alt: ogImage.alt }] } : {}),
    },
    // "summary_large_image" with no image renders WORSE than the small card, not
    // better: it reserves a large empty region. Upgrade only when an image exists.
    twitter: ogImage
      ? { card: "summary_large_image", title, description, images: [ogImage.src] }
      : { card: "summary", title, description },
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`
}

/**
 * schema.org Person for the profile.
 *
 * Every claim here is drawn from a published, tier-checked field, and the rules
 * that govern the visible page govern this too, arguably more strictly, because
 * structured data is consumed by machines that cannot read a disclaimer sitting
 * next to it.
 *
 * Specifically:
 *   - `honorificPrefix` is NEVER emitted. An honorific from a non-accredited body
 *     is not a name prefix (intake section 10), and this property is precisely
 *     where a "Dr." would leak back in after being kept off the page. The current
 *     subject has no honorific at all, section 6 fixes the name format as
 *     "Sanae Rakik", دون لقب, so today it would be inventing one outright.
 *   - `memberOf` names each organisation in full, exactly as stored. The full
 *     legal name always: an abbreviation is how a private body with an
 *     official-sounding name turns into a claim of affiliation with the
 *     institution it merely resembles.
 *   - `worksFor` is not emitted at all, see the note at the call site. Naming an
 *     affiliation is not the same as asserting employment by it.
 *   - `award` entries carry the full issuing body, because an award name alone
 *     reads as official without it. None exist today (intake section 4 records no
 *     verifiable awards), so the property is omitted rather than sent empty.
 *   - No `telephone`, no `address` beyond the country, no `email` that is not
 *     marked public. Section 15's NEVER PUBLISHED list applies here identically.
 *   - No `alumniOf`: no education row has been supplied, and an unaccredited one
 *     would not qualify if it were.
 */
export async function buildPersonJsonLd(locale: string) {
  const [settings, profile, positions, awards, expertise] = await Promise.all([
    getSiteSettings(),
    getProfileStrings(locale),
    getPositions(),
    getAwards(),
    getExpertise(),
  ])

  const base = settings.siteUrl as string
  const { localize } = await import("@/lib/localize")

  /*
   * AN UNCONFIRMED DOMAIN IS NOT AN IDENTITY CLAIM.
   *
   * `settings.siteUrl` is a PLACEHOLDER until `domainConfirmed` is true, the
   * intake form records that no domain has been chosen and asks us to propose a
   * shortlist. In `url` and `@id` that placeholder stops being a build convenience
   * and becomes an assertion about a real person: `url` on a Person is read as
   * "this is their official web presence", and `@id` mints a global identifier on
   * a host she may never own.
   *
   * So while the domain is unconfirmed the JSON-LD carries a FRAGMENT-ONLY `@id`
   * and omits `url` entirely. The node still works, a relative `@id` is valid and
   * still lets the graph reference itself, it simply stops naming a host.
   *
   * This is scoped to the identity claims on purpose. `metadataBase`, the canonical
   * tags and the sitemap all still use `base`, because those are mechanical
   * requirements that need SOME absolute origin to resolve against and are already
   * neutralised by the site being `noindex` until sign-off. The difference is that
   * a canonical is plumbing, while `url` on a Person is a statement about her.
   */
  const domainConfirmed = settings.domainConfirmed === true

  /*
   * Positions and memberships both name an organisation, and both belong in
   * `memberOf`. They are merged and de-duplicated by name because the same body
   * can legitimately appear in each, the current subject's IBC role is recorded
   * as a position AND as a membership, and emitting it twice would describe two
   * affiliations where there is one.
   *
   * A row with an empty organisation name is dropped: the partnership rows are
   * held at publish:false until their names are approved, and an unnamed
   * Organization node asserts an affiliation while identifying nothing.
   */
  const organisations = [
    ...positions.current.map((p) => ({ name: p.organisation, url: p.organisationUrl })),
    ...awards.memberships.map((m) => ({ name: m.organisation, url: m.organisationUrl })),
  ]
    .filter((o) => o.name && o.name.trim() !== "")
    .filter((o, i, all) => all.findIndex((x) => x.name === o.name) === i)
    .map((o) => ({
      "@type": "Organization",
      name: o.name,
      ...(o.url ? { url: o.url } : {}),
    }))

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": domainConfirmed ? `${base}#person` : "#person",
    name: profile.name,
    jobTitle: profile.title,
    description: profile.microBio,
    nationality: { "@type": "Country", name: profile.nationality },
    homeLocation: {
      "@type": "Place",
      // Country only. Intake section 6 records the location as "هولندا (المدينة
      // تُحدَّد لاحقًا إن رُغب في ذكرها)", the city is to be decided later if she
      // wants it named, so no locality is asserted in structured data either.
      address: { "@type": "PostalAddress", addressCountry: "NL" },
    },
    /*
     * ── DERIVED FROM data/expertise.json, NOT A SECOND HARDCODED LIST ────────────
     *
     * This was a literal array of three Language nodes maintained by hand alongside
     * the rows in data/expertise.json. Two lists of the same facts, and this is the
     * copy nobody looks at, so it is the copy that silently goes stale: adding the
     * English row to the data would have left the structured data claiming three
     * languages while the page showed four.
     *
     * ── NO PROFICIENCY IS EMITTED, AND THAT IS A DELIBERATE BOUNDARY ─────────────
     *
     * The rows now carry speaking and writing levels, and those levels are INFERRED
     * rather than supplied by her (see the `_comment_levels` block in
     * data/expertise.json, and open question Q9). None of them appears here.
     *
     * Two reasons, and the second is the one that matters. First, schema.org's
     * Language type has no proficiency property, so there is no correct field to put
     * one in. Second, and this is the standard this file's header sets out: structured
     * data is consumed by machines that cannot read a disclaimer sitting next to it.
     * On the page an inferred level renders beside a caption saying it is not her own
     * answer; a machine reading a proficiency claim here would get the assertion with
     * no way to receive the caveat. So the inference stops at the page boundary.
     *
     * What IS emitted is exactly what intake section 1 records: that she knows each of
     * these languages. That claim is hers, and it survives Q9 being answered either
     * way, which is why this block needs no revisiting when the levels are confirmed.
     *
     * `name` is the English name rather than localize()'d, because this is read by
     * machines: a stable English label plus the ISO code in `alternateName` is more
     * useful than a name that changes with whichever page happened to render. Rows
     * with no code or no English name are filtered, same as `organisations` above.
     */
    knowsLanguage: ((expertise.languages?.items ?? []) as { code?: string; name?: { en?: string } }[])
      .filter((l) => l.code && l.name?.en && l.name.en.trim() !== "")
      .map((l) => ({
        "@type": "Language",
        name: l.name!.en,
        alternateName: l.code,
      })),
    /*
     * `worksFor` IS DELIBERATELY NOT EMITTED, and the omission is the accurate
     * statement rather than a missing field.
     *
     * It used to be `organisations[0]`, which asserted schema.org employment by
     * the IBC. The data says something narrower: the role is "Consultant and
     * Strategic Representative", representation, not employment, and nothing in
     * the intake form records her as an employee of any organisation. A structured
     * -data employment claim is exactly the kind of overstatement this file's
     * header warns about, and it was worse than an on-page one for being invisible
     * to everyone except a search engine.
     *
     * Nothing is lost by dropping it. `jobTitle` already carries the role verbatim
     * and `memberOf` already names the organisation in full, which together state
     * the true relationship. If a genuine employment ever needs asserting, it has
     * to arrive as data that distinguishes employment from representation, not by
     * re-reading the first affiliation in a list and hoping.
     */
    memberOf: organisations,
    // Omitted entirely rather than emitted empty: intake section 4 records that no
    // awards exist that can be published and verified, and `award: []` in
    // structured data is a claim of "none" rather than the absence of a claim.
    ...(awards.awards.length > 0
      ? {
          award: awards.awards.map(
            (a) => `${localize(a.award, locale)}, ${a.issuingBody}${a.year ? ` (${a.year})` : ""}`,
          ),
        }
      : {}),
    ...(domainConfirmed ? { url: base } : {}),
    inLanguage: locale,
  }
}
