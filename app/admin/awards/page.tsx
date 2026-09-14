"use client"

import { toast } from "sonner"
import { Plus, ShieldAlert, Trash2 } from "@/components/admin/icons"
import { useSection, saveSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { FieldRow } from "@/components/admin/FieldRow"
import { LocalizedFieldRow } from "@/components/admin/LocalizedFieldRow"
import { SaveButton } from "@/components/admin/SaveButton"

const SECTION = "awards"

/**
 * Awards, honours and education.
 *
 * `accredited` is a three-state control — yes / no / unclear — rather than a
 * checkbox, because "unclear" is the honest answer for both awards in this file
 * and a checkbox has no way to say it. Collapsing unclear into unchecked would
 * record a finding nobody made.
 *
 * The education block carries the section 10 rule inline: an honorary title from a
 * non-accredited body may be listed here with the issuing body named in full, but
 * it can never become a name prefix. That rule is enforced independently in the
 * API, so it holds no matter what is typed.
 */
export default function AwardsAdminPage() {
  const { data, setData, error } = useSection<any>(SECTION)

  const save = async () => {
    await saveSection(SECTION, data)
    toast.success("Awards saved")
  }

  if (!data) return <LoadState error={error} />

  const awards = data.awards ?? []
  const education = data.education ?? []

  const updateAward = (i: number, patch: any) => {
    const next = [...awards]
    next[i] = { ...next[i], ...patch }
    setData({ ...data, awards: next })
  }

  const updateEdu = (i: number, patch: any) => {
    const next = [...education]
    next[i] = { ...next[i], ...patch }
    setData({ ...data, education: next })
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Intake sections 10 and 11</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Awards &amp; Education</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>

      <ContentSection
        title="Awards, honours and memberships"
        description="The issuing body is named in full every time the award is named. That is what keeps a private title from reading as a state honour."
      >
        {awards.map((a: any, i: number) => (
          <div key={a.id} className="space-y-4 border-b border-[color:var(--border)] pb-6 last:border-0">
            <LocalizedFieldRow label="Award or membership" value={a.award} onChange={(v) => updateAward(i, { award: v })} />

            <FieldRow
              label="Issuing body — full name"
              value={a.issuingBody}
              onChange={(v) => updateAward(i, { issuingBody: v })}
              hint="Written out in full. Never an acronym on its own."
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <FieldRow label="Year" value={a.year ?? ""} onChange={(v) => updateAward(i, { year: v })} />
              <FieldRow label="Reference no." value={a.refNo ?? ""} onChange={(v) => updateAward(i, { refNo: v })} />

              <div className="space-y-1.5">
                <label className="block text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)]">
                  Accredited
                </label>
                <select
                  value={String(a.accredited)}
                  onChange={(e) => {
                    const v = e.target.value
                    updateAward(i, { accredited: v === "true" ? true : v === "false" ? false : "unclear" })
                  }}
                  className="w-full border border-[color:var(--input)] bg-[color:var(--background)] px-3.5 py-2.5 text-sm text-[color:var(--card-foreground)] transition-colors focus:border-[color:var(--primary)] focus:outline-none"
                >
                  <option value="true">Yes — verifiable</option>
                  <option value="false">No</option>
                  <option value="unclear">Unclear</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
                <input
                  type="checkbox"
                  checked={a.publish !== false}
                  onChange={(e) => updateAward(i, { publish: e.target.checked })}
                  className="accent-[color:var(--primary)]"
                />
                Publish on the site
              </label>

              <button
                type="button"
                onClick={() => setData({ ...data, awards: awards.filter((_: any, x: number) => x !== i) })}
                className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--danger)]"
              >
                <Trash2 size={12} aria-hidden />
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setData({
              ...data,
              awards: [
                ...awards,
                {
                  id: `award-${Date.now()}`,
                  award: { tr: "", en: "", ar: "" },
                  issuingBody: "",
                  year: "",
                  refNo: "",
                  accredited: "unclear",
                  publish: false,
                },
              ],
            })
          }
          className="btn-outline"
        >
          <Plus size={15} aria-hidden />
          Add award
        </button>
      </ContentSection>

      <ContentSection title="Education and credentials" description="Intake section 10.">
        <p className="mb-5 flex gap-2.5 border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/12 p-4 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-[color:var(--danger)]" aria-hidden />
          <span>
            Honorary titles from non-accredited bodies are never used as a name prefix. They may be listed under Awards
            with the full issuing body named, if the client insists. Saves containing a doctoral prefix before her name
            are rejected regardless of what is set here.
          </span>
        </p>

        {education.map((e: any, i: number) => (
          <div key={e.id} className="space-y-3 border-b border-[color:var(--border)] pb-5 last:border-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <LocalizedFieldRow label="Institution" value={e.institution} onChange={(v) => updateEdu(i, { institution: v })} />
              <LocalizedFieldRow label="Qualification" value={e.qualification} onChange={(v) => updateEdu(i, { qualification: v })} />
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
                <input
                  type="checkbox"
                  checked={e.accredited === true}
                  onChange={(ev) => updateEdu(i, { accredited: ev.target.checked })}
                  className="accent-[color:var(--primary)]"
                />
                From a recognised institution
              </label>

              <label className="flex items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
                <input
                  type="checkbox"
                  checked={e.publish === true}
                  // Publishing an unaccredited qualification is the exact step the
                  // section 10 rule exists to prevent, so the control is disabled
                  // rather than merely discouraged.
                  disabled={e.accredited !== true}
                  onChange={(ev) => updateEdu(i, { publish: ev.target.checked })}
                  className="accent-[color:var(--primary)] disabled:opacity-40"
                />
                Publish
                {e.accredited !== true && (
                  <span className="text-xs text-[color:var(--danger)]">— not from a recognised institution</span>
                )}
              </label>
            </div>
          </div>
        ))}
      </ContentSection>

      <SaveButton onSave={save} />
    </div>
  )
}
