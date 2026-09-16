"use client"

import { toast } from "sonner"
import { Plus, ShieldAlert, Trash2 } from "@/components/admin/icons"
import { useSection, saveSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { LocalizedFieldRow } from "@/components/admin/LocalizedFieldRow"
import { emptyLocalized } from "@/components/admin/emptyLocalized"
import { SaveButton } from "@/components/admin/SaveButton"

const SECTION = "expertise"

const LEVELS = ["", "native", "fluent", "professional", "basic"] as const
const LEVEL_LABEL: Record<string, string> = {
  "": "Not set",
  native: "Native",
  fluent: "Fluent",
  professional: "Professional",
  basic: "Basic",
}

/*
 * ── THREE STATES, NOT A CHECKBOX ───────────────────────────────────────────────
 *
 * This was a single "Confirmed in writing" tickbox toggling between `confirmed` and
 * `to-confirm`. A third state now exists in the data, `inferred`, for the levels that
 * were worked out by the implementation rather than answered by her, and a two-state
 * control cannot represent it: an inferred row rendered UNTICKED, indistinguishable
 * from one nobody has looked at, and ticking the box to tidy it up would have
 * upgraded our guess to "she confirmed this in writing" with no record that anything
 * had changed. That is the one edit this editor must make impossible.
 *
 * So the states are named and mutually exclusive:
 *   to-confirm  nobody has answered. Renders as pending on the site.
 *   inferred    WE worked it out. Renders WITH a visible "not confirmed" caption.
 *   confirmed   she answered in writing. Renders clean.
 *
 * Only the third is a claim on her behalf, and reaching it now requires choosing it
 * by name.
 */
const STATUSES = ["to-confirm", "inferred", "confirmed"] as const
const STATUS_LABEL: Record<string, string> = {
  "to-confirm": "To confirm, nobody has answered",
  inferred: "Inferred by us, not her answer",
  confirmed: "Confirmed by her in writing",
}

/**
 * Expertise areas and the languages table.
 *
 * THE LANGUAGES TABLE IS THE CAREFUL PART. Intake section 8 is marked MUST
 * CONFIRM, with the instruction "Never assume a language level from the material
 * supplied", and the temptation is concrete: she is Dutch, based in the Netherlands,
 * and wrote her intake profile in both Arabic and English, from which "Dutch native,
 * Arabic fluent" is an easy and entirely unevidenced guess.
 *
 * So a level and a confirmation state are two separate controls, and setting a level
 * does not silently confirm the row. Confirming is a deliberate second act, because
 * the thing being recorded is not the level, it is that someone asked her and she
 * answered in writing.
 *
 * ── AND THAT GUESS HAS SINCE BEEN MADE, DELIBERATELY AND ON THE RECORD ──────────
 *
 * The levels in data/expertise.json are now filled in by inference, at the client's
 * explicit instruction after this exact conflict was put to them. THE STANDARD THIS
 * DOCBLOCK SETS IS STILL THE TARGET, not a historical curiosity: what changed is that
 * the guess is disclosed rather than withheld. Every inferred row carries
 * status:"inferred" plus a `_basis` string, renders on the site under a caption saying
 * it is not her answer, and contributes no proficiency to the JSON-LD.
 *
 * The third state exists so that "we worked it out" can never be mistaken for "she
 * told us". Open question Q9 retires it: ask her, set the rows to confirmed, and the
 * on-page caveat disappears on its own.
 */
export default function ExpertiseAdminPage() {
  const { data, setData, error } = useSection<any>(SECTION)

  const save = async () => {
    await saveSection(SECTION, data)
    toast.success("Expertise saved")
  }

  if (!data) return <LoadState error={error} />

  const items = data.items ?? []
  const languages = data.languages?.items ?? []

  const updateItem = (i: number, patch: any) => {
    const next = [...items]
    next[i] = { ...next[i], ...patch }
    setData({ ...data, items: next })
  }

  const updateLang = (i: number, patch: any) => {
    const next = [...languages]
    next[i] = { ...next[i], ...patch }
    setData({ ...data, languages: { ...data.languages, items: next } })
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Intake sections 5 and 8</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Expertise &amp; Languages</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>

      <ContentSection
        title="Areas of expertise"
        description="Five to eight short noun phrases. No sentences, the public grid is designed for phrases, not paragraphs."
      >
        {items.map((item: any, i: number) => (
          <div key={item.id} className="space-y-2 border-b border-[color:var(--border)] pb-5 last:border-0">
            <LocalizedFieldRow label={`Area ${i + 1}`} value={item.title} onChange={(v) => updateItem(i, { title: v })} />
            <button
              type="button"
              onClick={() => setData({ ...data, items: items.filter((_: any, x: number) => x !== i) })}
              className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--danger)]"
            >
              <Trash2 size={12} aria-hidden />
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setData({
              ...data,
              items: [...items, { id: `area-${Date.now()}`, icon: "globe", title: emptyLocalized() }],
            })
          }
          className="btn-outline"
        >
          <Plus size={15} aria-hidden />
          Add area
        </button>
      </ContentSection>

      <ContentSection title="Languages" description="Intake section 8: MUST CONFIRM.">
        <p className="mb-5 flex gap-2.5 border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/12 p-4 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-[color:var(--warning)]" aria-hidden />
          <span>
            Never assume a level from the material supplied. Setting a level does not confirm a row on its own.
            <br />
            <br />
            ⚠️ The four rows below are currently <strong>inferred</strong>: the levels were worked out by the
            implementation at the client&rsquo;s explicit instruction, NOT answered by her. They render on the site
            with a visible &ldquo;not confirmed&rdquo; caption, and no proficiency is sent to search engines. Open
            question Q9 is how this closes, ask her, then set each row to confirmed. Do not set a row to confirmed
            to tidy this warning away; that turns our guess into her statement.
          </span>
        </p>

        <div className="space-y-5">
          {languages.map((lang: any, i: number) => {
            // Anything unrecognised reads as "to-confirm", matching how
            // components/languages-table.tsx resolves it on the public side: a typo in
            // this field must never present as confirmed.
            const status = STATUSES.includes(lang.status) ? lang.status : "to-confirm"
            const confirmed = status === "confirmed"
            return (
              <div key={lang.code} className="space-y-3 border border-[color:var(--border)] bg-[color:var(--background)] p-4">
                <div className="flex items-center justify-between gap-4">
                  {/* The name is display-only, there is no input for it. A new language
                      is added by editing data/expertise.json, because the row also
                      needs a `code` and a localized `name` per locale. */}
                  <span className="font-display text-sm font-bold text-[color:var(--heading)]">
                    {lang.name?.en ?? lang.code}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Select
                    label="Speaking"
                    value={lang.speaking ?? ""}
                    onChange={(v) => updateLang(i, { speaking: v })}
                    options={LEVELS}
                    labels={LEVEL_LABEL}
                  />
                  <Select
                    label="Writing"
                    value={lang.writing ?? ""}
                    onChange={(v) => updateLang(i, { writing: v })}
                    options={LEVELS}
                    labels={LEVEL_LABEL}
                  />
                  <div className="space-y-1.5">
                    <label className="block text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)]">
                      Used in business
                    </label>
                    <label className="flex h-[42px] items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
                      <input
                        type="checkbox"
                        checked={lang.business === true}
                        onChange={(e) => updateLang(i, { business: e.target.checked })}
                        className="accent-[color:var(--primary)]"
                      />
                      Yes
                    </label>
                  </div>
                </div>

                <Select
                  label="Confirmation state"
                  value={status}
                  onChange={(v) => updateLang(i, { status: v })}
                  options={STATUSES}
                  labels={STATUS_LABEL}
                />

                {/* One branch per state, because the three render differently on the
                    public page and a single "not confirmed" warning would tell an
                    editor nothing about which of the two unconfirmed states they are
                    looking at. */}
                {status === "to-confirm" && (
                  <p className="text-[0.7rem] text-[color:var(--warning)]/80">
                    Renders on the site as &ldquo;to be confirmed&rdquo;, not as a level.
                  </p>
                )}
                {status === "inferred" && (
                  <p className="text-[0.7rem] text-[color:var(--warning)]/80">
                    Renders WITH an &ldquo;inferred, not confirmed&rdquo; caption beneath the table. This is our
                    reading, not her answer. Set to confirmed only once she has answered in writing, see open
                    question Q9.
                  </p>
                )}
                {lang._basis && (
                  /* The audit trail for an inferred row, written in data/expertise.json
                     rather than here. Shown read-only so an editor can see WHAT was
                     inferred from before deciding whether to promote the row. */
                  <p className="text-[0.7rem] leading-relaxed text-[color:var(--muted-foreground)]">
                    <span className="uppercase tracking-widest">Basis</span> · {lang._basis}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </ContentSection>

      <SaveButton onSave={save} />
    </div>
  )
}

/**
 * A labelled <select>. Takes its options rather than closing over LEVELS, so the same
 * control serves both the proficiency dropdowns and the status dropdown; it was
 * hardwired to LEVELS when a level was the only thing here with more than two states.
 */
function Select({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  labels: Record<string, string>
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[color:var(--input)] bg-[color:var(--background)] px-3.5 py-2.5 text-sm text-[color:var(--card-foreground)] transition-colors focus:border-[color:var(--primary)] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </div>
  )
}
