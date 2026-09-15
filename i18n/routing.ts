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

// TWO LOCALES, ENGLISH DEFAULT AND THEREFORE UNPREFIXED.
//
// Section 3 of the intake form asks for exactly this pair: "يُقترح إصدار الموقع
// باللغتين العربية والإنجليزية بما يناسب الجمهور الدولي". English carries the
// international business audience the profile is aimed at; Arabic serves the Gulf
// and wider Middle East side of the same work.
//
// Dutch and French are NOT locales here even though the subject speaks both. They
// are facts about her, recorded in data/expertise.json, not audiences the client
// asked the site to address, and a locale with no approved copy behind it is a
// half-translated site, which reads worse than a deliberate two.
export const routing = defineRouting({
  locales: ["en", "ar"] as const,
  defaultLocale: "en",
  localePrefix: "as-needed",
})

export type Locale = (typeof routing.locales)[number]

/** Arabic is the RTL locale; English is LTR. */
export const RTL_LOCALES: readonly string[] = ["ar"]

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale)
}
