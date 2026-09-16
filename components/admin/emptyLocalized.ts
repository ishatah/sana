import { routing } from "@/i18n/routing"

/**
 * A blank localized field, one empty string per locale the site ships.
 *
 * ── WHY THIS EXISTS RATHER THAN A LITERAL AT EACH CALL SITE ──────────────────────
 *
 * The "add a row" buttons in the admin editors used to seed new rows with a literal
 * `{ tr: "", en: "", ar: "" }`. Turkish was removed as a locale two changes ago and
 * that `tr` key outlived it in three separate files, seeding a dead locale into every
 * newly created position, award and expertise area.
 *
 * That is not a cosmetic leftover. lib/localize.ts explains the failure in detail: its
 * fallback walk ends in an `Object.values()` sweep that returns whatever key happens to
 * be declared FIRST, so a stale key sitting at the front of the object becomes the
 * value a visitor reads. It still renders text, which is exactly why nobody noticed.
 *
 * Deriving the shape from `routing.locales` makes that class of bug unrepresentable:
 * there is no literal list left to go stale, and a locale added or removed in
 * i18n/routing.ts is reflected here without anyone remembering to come and look.
 */
export function emptyLocalized(): Record<string, string> {
  return Object.fromEntries(routing.locales.map((l) => [l, ""]))
}
