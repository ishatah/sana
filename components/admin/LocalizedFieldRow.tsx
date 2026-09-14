"use client"

import { FieldRow } from "./FieldRow"

/**
 * One localized field across every locale the site ships.
 *
 * NAMED FOR THE JOB, NOT THE COUNT. This was `TrilingualFieldRow` when the site
 * ran Turkish, English and Arabic; it is bilingual now (intake section 3 asks for
 * Arabic and English only). Encoding the number in the name meant the name went
 * stale the moment the locale set changed, and a component called "Trilingual"
 * rendering two inputs is worse than no name at all.
 *
 * English comes first because it is the default locale and the only one whose copy
 * is authored rather than translated.
 *
 * The Arabic input carries dir="rtl" rather than just text-align: this is where
 * Arabic site copy is written, and without a base direction the caret, the
 * punctuation and any embedded Latin run behave as if the text were English.
 */
export function LocalizedFieldRow({
  label,
  value,
  onChange,
  multiline,
  hint,
}: {
  label: string
  value: Record<string, string> | undefined
  onChange: (next: Record<string, string>) => void
  multiline?: boolean
  hint?: string
}) {
  const v = value ?? {}
  const set = (locale: string, next: string) => onChange({ ...v, [locale]: next })

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <FieldRow label={`${label} (EN)`} value={v.en ?? ""} onChange={(x) => set("en", x)} multiline={multiline} />
        <FieldRow label={`${label} (AR)`} value={v.ar ?? ""} onChange={(x) => set("ar", x)} multiline={multiline} dir="rtl" />
      </div>
      {hint && <p className="text-[0.7rem] leading-relaxed text-[color:var(--muted-foreground)]">{hint}</p>}
    </div>
  )
}
