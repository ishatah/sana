"use client"

import { toast } from "sonner"
import { Plus, ShieldAlert, Trash2 } from "@/components/admin/icons"
import { useSection, saveSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { LocalizedFieldRow } from "@/components/admin/LocalizedFieldRow"
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

/**
 * Expertise areas and the languages table.
 *
 * THE LANGUAGES TABLE IS THE CAREFUL PART. Intake section 8 is marked MUST
 * CONFIRM, with the instruction "Never assume a language level from the material
 * supplied", and on this file the temptation is concrete: the client corresponds
 * from an ifb-us.org address and works the Iraqi market, from which "Arabic:
 * fluent, English: professional" is an easy and entirely unevidenced guess.
 *
 * So a level and a confirmation state are two separate controls, and setting a
 * level does not silently confirm the row. Confirming is a deliberate second act,
 * because the thing being recorded is not the level, it is that someone asked
 * her and she answered in writing.
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
              items: [...items, { id: `area-${Date.now()}`, icon: "globe", title: { tr: "", en: "", ar: "" } }],
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
            Never assume a level from the material supplied. A row stays &ldquo;to confirm&rdquo;, and renders as pending on
            the site, until she has answered in writing. Setting a level does not confirm the row on its own.
          </span>
        </p>

        <div className="space-y-5">
          {languages.map((lang: any, i: number) => {
            const confirmed = lang.status === "confirmed"
            return (
              <div key={lang.code} className="space-y-3 border border-[color:var(--border)] bg-[color:var(--background)] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-display text-sm font-bold text-[color:var(--heading)]">
                    {lang.name?.en ?? lang.code}
                  </span>
                  <label className="flex items-center gap-2.5 text-xs text-[color:var(--card-foreground)]">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) =>
                        updateLang(i, { status: e.target.checked ? "confirmed" : "to-confirm" })
                      }
                      className="accent-[color:var(--primary)]"
                    />
                    Confirmed in writing
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Select
                    label="Speaking"
                    value={lang.speaking ?? ""}
                    onChange={(v) => updateLang(i, { speaking: v })}
                  />
                  <Select label="Writing" value={lang.writing ?? ""} onChange={(v) => updateLang(i, { writing: v })} />
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

                {!confirmed && (
                  <p className="text-[0.7rem] text-[color:var(--warning)]/80">
                    Renders on the site as &ldquo;to be confirmed&rdquo;, not as a level.
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

function Select({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[color:var(--input)] bg-[color:var(--background)] px-3.5 py-2.5 text-sm text-[color:var(--card-foreground)] transition-colors focus:border-[color:var(--primary)] focus:outline-none"
      >
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {LEVEL_LABEL[l]}
          </option>
        ))}
      </select>
    </div>
  )
}
