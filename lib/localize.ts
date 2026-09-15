import type { Locale } from "@/i18n/routing"
import { routing } from "@/i18n/routing"

/**
 * A field that carries one string per locale. Every piece of editable copy in
 * `data/*.json` is stored this way rather than as three parallel files, so a
 * translator can never leave a key present in one locale and absent in another.
 */
export type LocalizedString = Partial<Record<Locale, string>> | string

/**
 * Resolve a localized field for one locale.
 *
 * AN EMPTY STRING IS TREATED AS ABSENT, not as a deliberate blank. That is the
 * single most important rule here and it is not a convenience: the admin editors
 * write "" into a field the moment someone focuses and clears it, and a stored
 * copy saved before a locale existed has no key at all. Both must degrade to the
 * next-best locale instead of rendering an empty heading.
 *
 * Fallback order is English → the first non-empty value. English leads because it
 * is `defaultLocale` and the locale whose copy is authored rather than translated.
 *
 * THIS LIST MUST NAME ONLY LOCALES THAT EXIST. It previously read
 * `["tr", "en"]`, and when Turkish was removed that first entry became a lookup
 * for a key no data file carries any more, silently falling through to the
 * `Object.values` sweep on every field, which returns whatever key happens to be
 * declared first rather than a chosen language. It still rendered text, which is
 * exactly why it would not have been noticed.
 *
 * WHERE THIS MUST NOT BE USED: an organisation's legal name. Those are stored as
 * plain strings in data/positions.json and data/awards.json precisely so no
 * fallback path can ever produce a translated or shortened form of a name the
 * intake form requires to be written out in full every time.
 */
export function localize(field: LocalizedString | null | undefined, locale: string): string {
  if (field == null) return ""
  if (typeof field === "string") return field

  const direct = field[locale as Locale]
  if (direct && direct.trim() !== "") return direct

  for (const fallback of ["en"] as const) {
    const value = field[fallback]
    if (value && value.trim() !== "") return value
  }

  for (const value of Object.values(field)) {
    if (value && value.trim() !== "") return value
  }

  return ""
}

/** True when a localized field has no usable copy in any locale. Drives the
 *  "hide the whole section" checks, an empty quote must not render an empty
 *  blockquote with a stray attribution under it. */
export function isEmpty(field: LocalizedString | null | undefined): boolean {
  return localize(field, routing.defaultLocale) === ""
}
