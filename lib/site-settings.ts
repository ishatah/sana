import { cmsSection } from "@/lib/cms-section"
import type { LocalizedString } from "@/lib/localize"
import settingsLocal from "@/data/siteSettings.json"
import deliverablesLocal from "@/data/deliverables.json"

export const getSiteSettings = cmsSection("siteSettings", settingsLocal as any)
export const getDeliverables = cmsSection("deliverables", deliverablesLocal as any)

/**
 * How a contact line may be used.
 *   public      — cleared for the website
 *   internal    — our file only; never rendered, never put in JSON-LD
 *   to-confirm  — withheld until the client answers open question Q6 in writing
 *
 * "to-confirm" is a separate state from "internal" on purpose. Both are withheld
 * today, but they resolve differently: an internal line stays internal forever,
 * while a to-confirm line is waiting on an answer and should show up in the admin
 * as an outstanding question rather than as a settled decision.
 */
export type Visibility = "public" | "internal" | "to-confirm"

export interface ContactEmail {
  id: string
  address: string
  visibility: Visibility
  primary?: boolean
  label?: LocalizedString
}

export interface ContactPhone {
  id: string
  number: string
  visibility: Visibility
  country?: string
}

export interface OfficeAddress {
  id: string
  address: string
  isHeadOffice: boolean | null
  current: string
  visibility: Visibility
}

/**
 * The contact details the site may actually show.
 *
 * Defaulting to withheld is the whole point: `visibility === "public"` is an
 * allowlist, so a line added later through /admin without an explicit decision is
 * hidden until someone makes one. The opposite default — hide only what is marked
 * internal — publishes anything anyone forgets to mark, and a personal phone
 * number is exactly the kind of thing that gets forgotten.
 *
 * EVERY CHANNEL IS WITHHELD TODAY. Intake section 6 defers all of them: the phone
 * and WhatsApp are "لا يُنشر في هذه المرحلة", and the email is "يُزوَّد لاحقًا" —
 * an official mailbox is to be created once a domain is chosen. So `emails`,
 * `phones` and `addresses` are all empty and the contact page offers the form and
 * the country, which is the honest state rather than a gap. Note also that a home
 * address, a personal number and a personal email are all on the NEVER PUBLISHED
 * list in section 15 and can never be unlocked by an override.
 */
export async function getPublicContact() {
  const settings = await getSiteSettings()
  const c = settings.contact ?? {}

  const isPublic = (v: { visibility?: Visibility }) => v.visibility === "public"

  const emails = ((c.emails ?? []) as ContactEmail[]).filter(isPublic)

  return {
    emails,
    primaryEmail: emails.find((e) => e.primary) ?? emails[0] ?? null,
    phones: ((c.phones ?? []) as ContactPhone[]).filter(isPublic),
    addresses: ((c.addresses ?? []) as OfficeAddress[]).filter(isPublic),
    cityOnly: c.cityOnly as LocalizedString,
    // Surfaced so the contact page can say "by email" honestly instead of
    // rendering a phone block that is silently empty.
    hasPhone: ((c.phones ?? []) as ContactPhone[]).some(isPublic),
    hasAddress: ((c.addresses ?? []) as OfficeAddress[]).some(isPublic),
  }
}

/** Everything still awaiting a written answer, for the admin dashboard. */
export async function getPendingContact() {
  const settings = await getSiteSettings()
  const c = settings.contact ?? {}
  const pending = (v: { visibility?: Visibility }) => v.visibility === "to-confirm"
  return {
    emails: ((c.emails ?? []) as ContactEmail[]).filter(pending),
    phones: ((c.phones ?? []) as ContactPhone[]).filter(pending),
    addresses: ((c.addresses ?? []) as OfficeAddress[]).filter(pending),
  }
}
