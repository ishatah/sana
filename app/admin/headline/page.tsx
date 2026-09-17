"use client"

import { toast } from "sonner"
import { useSection, saveSection } from "@/components/admin/useSection"
import { routing, isRtl } from "@/i18n/routing"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { LocalizedFieldRow } from "@/components/admin/LocalizedFieldRow"
import { SaveButton } from "@/components/admin/SaveButton"

const SECTION = "headline"

export default function HeadlineAdminPage() {
  const { data, setData, error } = useSection<any>(SECTION)

  const save = async () => {
    await saveSection(SECTION, data)
    toast.success("Headline saved")
  }

  if (!data) return <LoadState error={error} />
  const set = (k: string, v: any) => setData({ ...data, [k]: v })
  const setPos = (k: string, v: any) => setData({ ...data, positioning: { ...(data.positioning ?? {}), [k]: v } })

  const roles = data.rotatingRoles ?? {}
  // Split on the comma the editor types, trimming each entry. Empty segments are
  // dropped so a trailing comma cannot produce a blank word that types itself as
  // nothing in the hero.
  const setRoles = (locale: string, csv: string) =>
    set("rotatingRoles", {
      ...roles,
      [locale]: csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    })

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Intake sections 2 and 9</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Headline</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>

      <ContentSection title="Titles">
        <LocalizedFieldRow
          label="Primary professional title"
          value={data.primaryTitle}
          onChange={(v) => set("primaryTitle", v)}
          multiline
          hint="One line, sits under the name. Name the organisation in full, never an acronym on its own."
        />
        <LocalizedFieldRow
          label="Alternate short title"
          value={data.shortTitle}
          onChange={(v) => set("shortTitle", v)}
          hint="For LinkedIn, badges and name cards."
        />
        <LocalizedFieldRow label="Hero kicker" value={data.heroKicker} onChange={(v) => set("heroKicker", v)} />
      </ContentSection>

      <ContentSection
        title="Rotating roles"
        description="Typed one after another in the hero. Comma-separated. Every entry must correspond to a published position, the hero must not claim a role the positions table has not cleared."
      >
        {/* Driven by routing.locales rather than a literal list, so adding or
            removing a locale never leaves this editor one column short. */}
        <div className={`grid gap-3 ${routing.locales.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          {routing.locales.map((locale) => (
            <div key={locale} className="space-y-1.5">
              <label className="block text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)]">
                Roles ({locale.toUpperCase()})
              </label>
              <input
                value={(roles[locale] ?? []).join(", ")}
                onChange={(e) => setRoles(locale, e.target.value)}
                dir={isRtl(locale) ? "rtl" : "ltr"}
                className="w-full border border-[color:var(--input)] bg-[color:var(--background)] px-3.5 py-2.5 text-sm text-[color:var(--card-foreground)] transition-colors focus:border-[color:var(--primary)] focus:outline-none"
              />
            </div>
          ))}
        </div>
      </ContentSection>

      {/*
        THIS SECTION IS PUBLISHED. Its description used to read "Internal, this
        does not render on the site, it steers the copy", which was true when it
        was written and is not true now: the three identity fields are the three
        panels under مجال التركيز on /about, and the `*Detail` field beside each
        one is the sentence inside that panel. Anything typed here is live copy.
      */}
      <ContentSection
        title="Positioning"
        description="Intake section 9. These are the three panels in the Focus section on the About page. Each has a short answer and a supporting sentence; the sentence is optional and the panel renders without it."
      >
        <LocalizedFieldRow
          label="Primary professional identity"
          value={data.positioning?.primaryIdentity}
          onChange={(v) => setPos("primaryIdentity", v)}
        />
        <LocalizedFieldRow
          label="Primary identity — supporting line"
          value={data.positioning?.primaryIdentityDetail}
          onChange={(v) => setPos("primaryIdentityDetail", v)}
        />
        <LocalizedFieldRow
          label="Secondary identity"
          value={data.positioning?.secondaryIdentity}
          onChange={(v) => setPos("secondaryIdentity", v)}
        />
        <LocalizedFieldRow
          label="Secondary identity — supporting line"
          value={data.positioning?.secondaryIdentityDetail}
          onChange={(v) => setPos("secondaryIdentityDetail", v)}
        />
        <LocalizedFieldRow label="Audience" value={data.positioning?.audience} onChange={(v) => setPos("audience", v)} />
        <LocalizedFieldRow
          label="Audience — supporting line"
          value={data.positioning?.audienceDetail}
          onChange={(v) => setPos("audienceDetail", v)}
        />
      </ContentSection>

      <SaveButton onSave={save} />
    </div>
  )
}
