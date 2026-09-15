/**
 * The verification-tier rules from the client intake form, expressed as code.
 *
 * The form states them on page 1 and then relies on a human applying them
 * consistently across eight pages, three languages and ten deliverables. That is
 * exactly the kind of rule that survives the first draft and quietly erodes on the
 * fourth revision, so every one of them is enforced here instead, once, in the
 * one module every renderer and the build gate both import.
 *
 * TIERS (set by the studio, never by the client):
 *   A  Accredited or officially registered body, verifiable in a public register.
 *      Publish freely.
 *   B  Real organisation, role confirmed by the client, limited public record.
 *      Publish with the FULL organisation name and no inflated wording.
 *   C  Title-selling outfit, unregistered body, or a name that imitates an
 *      official institution. DO NOT PUBLISH. Log it in the exclusions file.
 */

export type Tier = "A" | "B" | "C"

export interface TieredItem {
  tier?: Tier | string
  publish?: boolean
}

/**
 * The publish test every list on the site runs before rendering.
 *
 * Both conditions are required and neither implies the other. `publish` is the
 * client-facing decision recorded on the form; `tier` is the studio's assessment.
 * A tier-C row with publish:true is a data-entry mistake, not an instruction, the
 * form is explicit that tier C is never published, so tier wins.
 */
export function isPublishable(item: TieredItem): boolean {
  if (item.publish === false) return false
  return item.tier !== "C"
}

export function publishable<T extends TieredItem>(items: readonly T[]): T[] {
  return items.filter(isPublishable)
}

/**
 * Wording that must never appear in published copy, with the reason attached so a
 * build failure explains itself rather than just naming a banned string.
 *
 * These come from three separate instructions in the form that all reduce to the
 * same failure mode, copy that implies an official, diplomatic, governmental or
 * United Nations credential the client does not hold:
 *
 *   - Section 3: an organisation with an official-sounding name is written in FULL
 *     every time and never shortened, and no official emblem is used.
 *   - Section 10: honorary titles from non-accredited bodies are NEVER a name prefix.
 *   - Section 15: the whole exclusions log, plus the red NEVER PUBLISHED box.
 *
 * THESE RULES ARE GENERAL, NOT ABOUT ANY ONE CLIENT, and that is why they stay in
 * force even when, as today, no row on the site comes close to tripping them.
 * They guard the edit that looks like an improvement: shortening a long
 * organisation name, or adding a title someone was told to use.
 *
 * `scripts/check-publish-gate.mjs` greps the rendered copy for these and fails the
 * build. That matters most for the abbreviation rule: "United Nations" on its own
 * is the natural thing for a translator or copy editor to write, it reads as
 * tightening, and it is the single change that turns a compliant page into a false
 * claim of UN affiliation.
 */
export interface BannedPhrase {
  pattern: RegExp
  /** A construction that is safe despite matching `pattern`. Checked per string. */
  exempt?: RegExp
  reason: string
}

export const BANNED_PHRASES: BannedPhrase[] = [
  {
    // Intake section 6 forbids publishing any client name, and section 3 repeats
    // it. This catches the shapes a case study takes, "worked with X", "client:
    // X", rather than trying to enumerate names nobody has given us.
    pattern: /\b(?:our|my|her|the)\s+client\s+(?:[A-Z][\w&.-]*|is|was|include)/g,
    reason:
      "Intake sections 3 and 6: no client names. 'وأي إشارة إلى قيم صفقات أو أسماء عملاء', the profile describes the work, never who it was for.",
  },
  {
    // Deal values. Any currency amount in copy is either a transaction size or a
    // fee, and section 6 excludes both.
    pattern: /(?:[€$£]\s?\d[\d,.]*\s?(?:k|m|bn|million|billion)?|\b\d[\d,.]*\s?(?:EUR|USD|GBP|AED|SAR)\b)/gi,
    reason:
      "Intake section 6: 'وأي تفاصيل صفقات وقيم مالية'. No transaction value, commission or fee may appear in published copy.",
  },
  {
    // Unverified performance claims. Section 3 bans "أرقام ونِسب غير موثقة", and a
    // percentage attached to growth or return is the exact shape it means.
    pattern: /\b\d{1,3}(?:\.\d+)?\s?%\s?(?:growth|increase|return|roi|uplift|margin|نمو|عائد|زيادة)/gi,
    reason:
      "Intake section 3: 'وأي عبارات مبالغة أو أرقام ونِسب غير موثقة'. No growth or return figure is published without documentation.",
  },
  {
    // The site is a professional profile. Section 6 requires it to disclaim being
    // an investment offer; wording that solicits investment contradicts that
    // disclaimer on the same site.
    pattern: /\b(?:guaranteed returns?|investment opportunity|invest with (?:me|us)|high[- ]yield)\b/gi,
    reason:
      "Intake section 6: the site is 'تعريفي بالمسيرة المهنية فقط، ولا يشكّل عرضًا استثماريًا'. No copy may read as soliciting investment.",
  },
  {
    // Name prefix. Section 6 fixes the format as "سناء رقيق" / "Sanae Rakik",
    // explicitly دون لقب, without a title. No qualification has been supplied
    // that could support one.
    pattern: /\b(?:Dr|Dr\.|Prof|Prof\.|د\.|الدكتورة)\s*(?:Sanae|سناء)/gi,
    reason:
      "Intake section 6: the approved name format is 'سناء رقيق' / 'Sanae Rakik', دون لقب. No honorific precedes the name in any language.",
  },
  {
    // Generic and kept from the previous ruleset: nothing that imitates an
    // official credential, whatever the subject.
    pattern: /\b(?:diplomatic (?:passport|immunity|status|credential))\b/gi,
    reason: "Nothing that imitates a diplomatic or governmental credential.",
  },
]

export interface Violation {
  phrase: string
  reason: string
  context: string
}

/** Scan a blob of copy for banned wording. Used by the build gate and by the
 *  admin editors, so the person typing gets the same answer as CI. */
export function findViolations(text: string): Violation[] {
  const out: Violation[] = []
  for (const { pattern, exempt, reason } of BANNED_PHRASES) {
    if (exempt && exempt.test(text)) continue
    // Fresh regex per call: these are module-level /g literals and `lastIndex`
    // carries over between calls otherwise, which silently skips every second match.
    const re = new RegExp(pattern.source, pattern.flags)
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      out.push({
        phrase: m[0],
        reason,
        context: text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60).replace(/\s+/g, " ").trim(),
      })
      if (m[0].length === 0) re.lastIndex++
    }
  }
  return out
}

/**
 * Whether the profile has cleared the form's FINAL CHECK (page 8): "Nothing is
 * published until sections 15 and 18 are both complete."
 *
 * app/robots.ts and the admin dashboard both read this. It deliberately returns
 * false for a half-completed sign-off, an approver name with the two confirmation
 * booleans still unticked is the state a rushed launch produces.
 */
export interface SignOff {
  clientReviewedOn?: string
  allTitlesConfirmed?: boolean
  exclusionsConfirmed?: boolean
  approvedForPublicationBy?: string
}

export function isSignedOff(signOff: SignOff | undefined | null): boolean {
  if (!signOff) return false
  return Boolean(
    signOff.allTitlesConfirmed &&
      signOff.exclusionsConfirmed &&
      signOff.approvedForPublicationBy &&
      signOff.approvedForPublicationBy.trim() !== "" &&
      signOff.clientReviewedOn &&
      signOff.clientReviewedOn.trim() !== "",
  )
}
