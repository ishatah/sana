"use client"

import { FieldRow } from "./FieldRow"
import { routing, isRtl } from "@/i18n/routing"

/**
 * One localized field across every locale the site ships.
 *
 * ── NAMED FOR THE JOB, AND NOW DRIVEN BY THE LOCALE LIST TOO ────────────────────
 *
 * This was `TrilingualFieldRow` under Turkish/English/Arabic, became bilingual when
 * Turkish was dropped, and is three again now that Dutch has been added. That history
 * is the whole argument: encoding the COUNT in the name went stale on the first
 * change, and hardcoding the LIST in the body went stale on the second. It rendered
 * exactly two inputs, `en` and `ar`, so a Dutch value could be present in
 * data/*.json with no way to edit it, across all seven admin editors at once, because
 * every localized field on every one of them comes through this component.
 *
 * So the inputs come from `routing.locales` now. Adding a fourth locale means a
 * catalogue file and a LABELS line in the language toggle; it does not mean touching
 * this file.
 *
 * English comes first because it is `defaultLocale` and the only locale whose copy is
 * authored rather than translated. That ordering is `routing.locales`' own, not
 * re-sorted here, so the two cannot disagree.
 *
 * ── WHY `dir` AND NOT `text-align` ──────────────────────────────────────────────
 *
 * The Arabic input carries a real base direction rather than just right-aligned text.
 * This is where Arabic site copy is actually written, and without a base direction the
 * caret, the punctuation and any embedded Latin run (an organisation name, a URL) all
 * behave as if the text were English, which makes the field unusable for its one job.
 *
 * It comes from `isRtl()` rather than an inline `l === "ar"`, because the site keeps
 * one source of truth for direction in i18n/routing.ts. A second inline comparison is
 * how the two drift apart. LTR is passed explicitly rather than left undefined, since
 * an admin panel may itself be viewed inside an RTL document.
 */

/**
 * Tailwind cannot see a class it never reads as a literal, so `lg:grid-cols-${n}` is
 * purged and silently produces no rule at all. The literals live here, keyed by locale
 * count, so the scanner finds them while the choice stays derived.
 *
 * AT FOUR LOCALES, STOP AND RECONSIDER RATHER THAN ADDING A FIFTH LINE. Four columns
 * of text inputs on a laptop is around 200px each, which is too narrow to write a
 * paragraph of biography in. The right answer past three is a stacked or tabbed
 * layout, and that should be a decision someone makes deliberately, not something that
 * happens because a lookup table had another row free.
 */
const COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
}

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
      <div className={`grid gap-3 ${COLS[routing.locales.length] ?? "lg:grid-cols-3"}`}>
        {routing.locales.map((l) => (
          <FieldRow
            key={l}
            label={`${label} (${l.toUpperCase()})`}
            value={v[l] ?? ""}
            onChange={(x) => set(l, x)}
            multiline={multiline}
            dir={isRtl(l) ? "rtl" : "ltr"}
          />
        ))}
      </div>
      {hint && <p className="text-[0.7rem] leading-relaxed text-[color:var(--muted-foreground)]">{hint}</p>}
    </div>
  )
}
