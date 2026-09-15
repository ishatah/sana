import { cmsSection } from "@/lib/cms-section"
import { localize, isEmpty, type LocalizedString } from "@/lib/localize"
import { publishable, type Tier } from "@/lib/verification"

import identityLocal from "@/data/identity.json"
import headlineLocal from "@/data/headline.json"
import positionsLocal from "@/data/positions.json"
import expertiseLocal from "@/data/expertise.json"
import biographyLocal from "@/data/biography.json"
import awardsLocal from "@/data/awards.json"
import navigationLocal from "@/data/navigation.json"

export const getIdentity = cmsSection("identity", identityLocal as any)
export const getHeadline = cmsSection("headline", headlineLocal as any)
export const getExpertise = cmsSection("expertise", expertiseLocal as any)
export const getBiography = cmsSection("biography", biographyLocal as any)
export const getNavigation = cmsSection("navigation", navigationLocal as any)

const getPositionsRaw = cmsSection("positions", positionsLocal as any)
const getAwardsRaw = cmsSection("awards", awardsLocal as any)

export interface Position {
  id: string
  organisation: string
  organisationUrl?: string
  registerConfirmed?: boolean
  role: LocalizedString
  city?: LocalizedString
  startYear?: string
  endYear?: string
  tier: Tier
  publish: boolean
  condition?: string
  disclaimer?: LocalizedString
}

/**
 * The positions the site is allowed to render.
 *
 * `publishable()` drops anything tier C or publish:false. Nothing tier C exists in
 * the file today, the title-selling items were caught at intake and live in
 * data/exclusions.json instead, but the filter is what guarantees that adding one
 * later through /admin cannot put it on the page.
 *
 * Note what is NOT done here: the organisation name is passed through untouched.
 * It is not localized, not abbreviated, not title-cased. Intake section 3 requires
 * the full legal name on every rendering, and the surest way to honour that is to
 * give no code path the opportunity to rewrite it.
 */
export async function getPositions() {
  const data = await getPositionsRaw()
  return {
    current: publishable((data.current ?? []) as Position[]),
    previous: publishable((data.previous ?? []) as Position[]),
    registerNote: data.registerNote as LocalizedString,
  }
}

export interface Award {
  id: string
  award: LocalizedString
  issuingBody: string
  year?: string
  refNo?: string
  accredited: boolean | "unclear"
  publish: boolean
}

/**
 * A membership or affiliation.
 *
 * `organisation` is a PLAIN STRING, like the one on `Position` and for the same
 * reason: a registered legal name must never pass through a localization fallback
 * that could return a translated or shortened form of it.
 */
export interface Membership {
  id: string
  organisation: string
  organisationUrl?: string
  role: LocalizedString
  summary?: LocalizedString
  period?: string
  tier: Tier
  publish: boolean
}

/**
 * Memberships, awards and education.
 *
 * MEMBERSHIPS ARE THE ONLY POPULATED LIST HERE for this subject, and the other two
 * are empty by instruction rather than by omission: intake section 4 records "لا
 * توجد جوائز أو أرقام أو صفقات قابلة للنشر والتحقق" for awards and "لم يُزوَّد"
 * for education. The recognition page was removed rather than left to render a
 * heading over an empty list.
 *
 * All three are filtered through `publishable()` rather than on `publish` alone,
 * so a tier-C row can never reach a page even if someone sets publish:true on it.
 */
export async function getAwards() {
  const data = await getAwardsRaw()
  return {
    awards: publishable((data.awards ?? []) as Award[]),
    education: publishable((data.education ?? []) as any[]),
    memberships: publishable((data.memberships ?? []) as Membership[]),
  }
}

/**
 * Which optional sections have enough content to render.
 *
 * For THIS subject `quote` and `fullBio` are both true, she supplied a complete
 * biography and an attributable philosophy statement at intake, while `stats`,
 * `press` and `achievements` stay false, because intake section 4 records no
 * publishable figures, no media requirement and no awards.
 *
 * The rule the whole layer exists to enforce is unchanged: a page must omit a
 * section rather than render a heading over a void. An empty stat counter reading
 * 0 is worse than no counter, and an empty blockquote with an attribution under
 * it reads as a quote she never gave.
 */
export async function getSectionAvailability(locale: string) {
  const bio = await getBiography()
  const { awards } = await getAwards()

  const stats = (bio.stats ?? []).filter((s: any) => s.value !== null && s.value !== undefined && s.value !== "")

  return {
    quote: !isEmpty(bio.quote),
    stats: stats.length > 0,
    press: (bio.press ?? []).length > 0,
    achievements: (bio.achievements ?? []).length > 0,
    awards: awards.length > 0,
    fullBio: !isEmpty(bio.fullBio),
    _resolvedStats: stats,
    _locale: locale,
  }
}

/** Convenience for metadata and JSON-LD, which need plain strings. */
export async function getProfileStrings(locale: string) {
  const [identity, headline, bio] = await Promise.all([getIdentity(), getHeadline(), getBiography()])
  return {
    name: identity.namePrint as string,
    title: localize(headline.primaryTitle, locale),
    shortTitle: localize(headline.shortTitle, locale),
    microBio: localize(bio.microBio, locale),
    shortBio: localize(bio.shortBio, locale),
    nationality: localize(identity.nationality, locale),
    residence: localize(identity.residence, locale),
  }
}
