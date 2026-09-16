import { defineRouting } from "next-intl/routing"

// Every next-intl provider must be handed this, `i18n/request.ts` configures the
// SERVER only, and each NextIntlClientProvider builds its own config from scratch.
// A provider without it falls back to the runtime's zone (the server's on the
// server, the visitor's in the browser), so a formatted date renders differently
// in the two passes and React reports a hydration mismatch.
//
// UNLIKE THE PREVIOUS ZONE, THIS ONE HAS DST. Europe/Istanbul was UTC+3 all year,
// so a naive fixed offset happened to work; Europe/Amsterdam shifts between CET
// and CEST, which is exactly the case a hardcoded offset gets wrong twice a year.
// Naming the zone rather than an offset keeps that correct without thinking.
export const TIME_ZONE = "Europe/Amsterdam"

// THREE LOCALES, ENGLISH DEFAULT AND THEREFORE UNPREFIXED.
//
// Each one is an audience, not a language she happens to speak:
//   en  the international business audience the profile is aimed at, and the only
//       locale whose copy is authored rather than translated
//   ar  the Gulf and wider Middle East side of the same work. Section 3 of the
//       intake form asks for this pair by name: "يُقترح إصدار الموقع باللغتين
//       العربية والإنجليزية بما يناسب الجمهور الدولي"
//   nl  her home market. She is a Dutch national based in the Netherlands, so this
//       is the audience that reads her in her own first language
//
// ── WHY THIS USED TO ARGUE FOR TWO, AND WHY THAT ARGUMENT IS SPENT ──────────────
//
// This comment previously said Dutch must NOT be a locale, on the grounds that "a
// locale with no approved copy behind it is a half-translated site, which reads
// worse than a deliberate two". That reasoning was right and it has not been
// overturned, it has been SATISFIED: messages/nl.json is complete, every localized
// object in data/*.json carries an `nl` value, and the three legal pages have Dutch
// bodies rather than falling through to blank. The condition was the copy, and the
// copy now exists. Remove the copy and the old argument applies again immediately.
//
// ── FRENCH IS STILL NOT A LOCALE, AND THAT IS THE SAME RULE STILL RUNNING ───────
//
// She speaks French too (data/expertise.json). It stays a fact about her rather
// than a locale, because nobody has asked the site to address a French audience and
// there is no approved French copy. The test for adding a locale is an audience
// plus copy, never "she speaks it", or this list grows one entry per language on the
// languages table and each one ships half-finished.
export const routing = defineRouting({
  locales: ["en", "ar", "nl"] as const,
  defaultLocale: "en",
  localePrefix: "as-needed",
})

export type Locale = (typeof routing.locales)[number]

/**
 * Arabic is the RTL locale; English and Dutch are LTR.
 *
 * Dutch was added to `routing.locales` above and deliberately NOT added here, because
 * it is a Latin-script LTR language. The omission is a decision rather than an
 * oversight, which is worth stating: this list and the locale list are edited in the
 * same breath, so a reader finding three locales and one RTL entry should not have to
 * wonder whether the third was simply forgotten.
 *
 * Everything that sets direction goes through `isRtl` rather than comparing against
 * "ar" inline, so there is exactly one place to change if that ever stops being true.
 */
export const RTL_LOCALES: readonly string[] = ["ar"]

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale)
}
