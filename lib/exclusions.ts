import { cmsSection } from "@/lib/cms-section"
import type { LocalizedString } from "@/lib/localize"
import exclusionsLocal from "@/data/exclusions.json"

export const getExclusions = cmsSection("exclusions", exclusionsLocal as any)

export interface ExclusionItem {
  id: string
  item: string
  reason: LocalizedString
  informed: boolean
  override: boolean
  /** Set false on items no client override can ever unlock. */
  overrideAllowed?: boolean
  blockedTerms: string[]
}

/**
 * The exclusions log — intake form section 15, "everything received but not used,
 * with the reason. This protects the client and us."
 *
 * It is deliberately part of the application rather than a note in a document.
 * The log is what the build gate reads to know which strings must never appear in
 * published copy, so the record and the enforcement cannot drift apart: adding an
 * exclusion in /admin also bans its wording, and removing one is a visible edit
 * with an audit trail rather than a silent omission.
 *
 * NONE OF THIS IS RENDERED ON THE PUBLIC SITE. The log names title-selling outfits
 * and explains why each was rejected; publishing that would be both defamatory
 * risk and an odd thing to put on a client's own profile. It exists for /admin and
 * for CI.
 */
export async function getBlockedTerms(): Promise<string[]> {
  const data = await getExclusions()
  const items = (data.items ?? []) as ExclusionItem[]
  return items
    // An override lifts the ban on the wording — but per the form's FINAL CHECK,
    // the item still goes in with the full organisation name and no diplomatic or
    // United Nations wording, which lib/verification.ts enforces separately and
    // unconditionally. An override can never reach those rules.
    .filter((i) => !i.override)
    .flatMap((i) => i.blockedTerms ?? [])
    .filter(Boolean)
}

/**
 * Items that carry `overrideAllowed: false` plus the NEVER PUBLISHED list from the
 * red box in section 15. No client instruction unlocks these — passport and
 * national ID numbers, identity scans, home address, bank details, family details,
 * and anything imitating a diplomatic, governmental or United Nations credential.
 *
 * The admin UI renders these without an override control at all, rather than with
 * a control that refuses: a switch that cannot be flipped invites someone to try.
 */
export async function getAbsoluteExclusions() {
  const data = await getExclusions()
  const items = (data.items ?? []) as ExclusionItem[]
  return {
    items: items.filter((i) => i.overrideAllowed === false),
    neverPublished: (data.neverPublished?.items ?? []) as string[],
  }
}

/** Overrides the client has given in writing, for the sign-off record. */
export async function getOverrides() {
  const data = await getExclusions()
  return ((data.items ?? []) as ExclusionItem[]).filter((i) => i.override)
}
