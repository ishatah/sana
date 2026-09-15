"use client"

import { toast } from "sonner"
import { ShieldAlert } from "@/components/admin/icons"
import { useSection, saveSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { FieldRow } from "@/components/admin/FieldRow"
import { LocalizedFieldRow } from "@/components/admin/LocalizedFieldRow"
import { SaveButton } from "@/components/admin/SaveButton"

const SECTION = "identity"

export default function IdentityAdminPage() {
  const { data, setData, error } = useSection<any>(SECTION)

  const save = async () => {
    await saveSection(SECTION, data)
    toast.success("Identity saved")
  }

  if (!data) return <LoadState error={error} />
  const set = (k: string, v: any) => setData({ ...data, [k]: v })

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Intake sections 1, 6 and 7</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Identity</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>

      <ContentSection title="Name">
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Full legal name (Latin)" value={data.nameLatin} onChange={(v) => set("nameLatin", v)} />
          <FieldRow label="Name in local script" value={data.nameLocal} onChange={(v) => set("nameLocal", v)} />
          <FieldRow label="Name as it appears in print" value={data.namePrint} onChange={(v) => set("namePrint", v)} />
          <FieldRow label="Preferred short form" value={data.nameShort} onChange={(v) => set("nameShort", v)} />
          <FieldRow label="Name in Arabic" value={data.nameArabic} onChange={(v) => set("nameArabic", v)} dir="rtl" />
        </div>

        {/*
          The honorific field carries its own warning because it is the single
          highest-risk input in the whole panel. Intake section 10: the 2024
          honorary doctorate is not from a recognised university, so no prefix may
          be used, and a save containing "Dr. Sanae" is rejected by the API
          regardless of what is typed here.
        */}
        <div className="space-y-2 border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/12 p-4">
          <FieldRow
            label="Honorific or prefix"
            value={data.honorific ?? ""}
            onChange={(v) => set("honorific", v)}
            placeholder="Leave empty"
          />
          <p className="flex gap-2 text-[0.7rem] leading-relaxed text-[color:var(--muted-foreground)]">
            <ShieldAlert size={13} className="mt-0.5 shrink-0 text-[color:var(--danger)]" aria-hidden />
            <span>
              A prefix is used only if the qualifying body is accredited. The 2024 honorary doctorate is not from a
              recognised university and cannot support one. Saves containing a doctoral prefix before this name are
              rejected.
            </span>
          </p>
        </div>

        <FieldRow
          label="Pronunciation / naming note"
          value={data.pronunciationNote ?? ""}
          onChange={(v) => set("pronunciationNote", v)}
          multiline
        />
      </ContentSection>

      <ContentSection title="Origin and base" description="Intake section 6.">
        <LocalizedFieldRow label="Nationality" value={data.nationality} onChange={(v) => set("nationality", v)} />
        <LocalizedFieldRow label="Place of birth" value={data.placeOfBirth} onChange={(v) => set("placeOfBirth", v)} />
        <LocalizedFieldRow label="City and country of residence" value={data.residence} onChange={(v) => set("residence", v)} />
        <LocalizedFieldRow label="Main city of work" value={data.mainCityOfWork} onChange={(v) => set("mainCityOfWork", v)} />
        <LocalizedFieldRow label="Other markets covered" value={data.otherMarkets} onChange={(v) => set("otherMarkets", v)} />
      </ContentSection>

      <ContentSection title="Experience" description="Intake section 7.">
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Years of experience" value={data.yearsOfExperience} onChange={(v) => set("yearsOfExperience", v)} />
          <FieldRow
            label="Career start year"
            value={data.careerStartYear ?? ""}
            onChange={(v) => set("careerStartYear", v)}
            hint="Blank on the intake form. The About section omits the row entirely rather than deriving a year from the 10+ answer."
          />
        </div>
        <LocalizedFieldRow label="Sector or industry" value={data.sector} onChange={(v) => set("sector", v)} />
      </ContentSection>

      <SaveButton onSave={save} />
    </div>
  )
}
