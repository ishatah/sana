"use client"

import { toast } from "sonner"
import { Info } from "@/components/admin/icons"
import { useSection, saveSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { LocalizedFieldRow } from "@/components/admin/LocalizedFieldRow"
import { FieldRow } from "@/components/admin/FieldRow"
import { SaveButton } from "@/components/admin/SaveButton"

const SECTION = "biography"

/**
 * The biography editor.
 *
 * Intake section 12 is the largest gap in the file — no achievements, no figures,
 * no press, no quote. Rather than present empty inputs with no explanation, each
 * block names the open question that unblocks it, so whoever opens this page knows
 * what to ask for instead of being tempted to fill it in.
 */
export default function BiographyAdminPage() {
  const { data, setData, error } = useSection<any>(SECTION)

  const save = async () => {
    await saveSection(SECTION, data)
    toast.success("Biography saved")
  }

  if (!data) return <LoadState error={error} />
  const set = (k: string, v: any) => setData({ ...data, [k]: v })

  const stats = data.stats ?? []
  const setStat = (i: number, value: string) => {
    const next = [...stats]
    // An empty input means "no figure supplied", which is null — NOT 0. A zero
    // would render a counter reading 0, which asserts a measured result of none.
    next[i] = { ...next[i], value: value.trim() === "" ? null : value.trim() }
    set("stats", next)
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Intake section 12</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Biography</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>

      <ContentSection title="Bios" description="Micro 25–40 words · Short 80–120 words · Full 250–350 words.">
        <LocalizedFieldRow label="Micro bio" value={data.microBio} onChange={(v) => set("microBio", v)} multiline />
        <LocalizedFieldRow label="Short bio" value={data.shortBio} onChange={(v) => set("shortBio", v)} multiline />
        <LocalizedFieldRow label="About intro" value={data.aboutIntro} onChange={(v) => set("aboutIntro", v)} multiline />
        <LocalizedFieldRow
          label="Full bio"
          value={data.fullBio}
          onChange={(v) => set("fullBio", v)}
          multiline
          hint="Blocked on Q3 — two or three concrete achievements with dates. Write this only once those are supplied; do not pad it with adjectives in place of facts."
        />
      </ContentSection>

      <ContentSection
        title="Quotable line"
        description="Nothing was supplied at intake. Ask her for two or three sentences in her own words — do not write one on her behalf. The quote section stays hidden while this is empty."
      >
        <LocalizedFieldRow label="Quote" value={data.quote} onChange={(v) => set("quote", v)} multiline />
        <FieldRow label="Attribution" value={data.quoteAttribution ?? ""} onChange={(v) => set("quoteAttribution", v)} />
      </ContentSection>

      <ContentSection
        title="Measurable results"
        description="Members represented, events per year, companies matched, countries covered. Leave a field empty when no figure has been supplied."
      >
        <p className="mb-4 flex gap-2.5 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          <Info size={14} className="mt-0.5 shrink-0 text-[color:var(--primary)]" aria-hidden />
          <span>
            The counter block renders only when at least one figure is present. An empty field is stored as
            &ldquo;no figure supplied&rdquo;, never as zero.
          </span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.map((s: any, i: number) => (
            <FieldRow
              key={s.id}
              label={s.label?.en ?? s.id}
              value={s.value ?? ""}
              onChange={(v) => setStat(i, v)}
              placeholder="Not supplied"
            />
          ))}
        </div>
      </ContentSection>

      <SaveButton onSave={save} />
    </div>
  )
}
