"use client"

import { toast } from "sonner"
import { Info } from "@/components/admin/icons"
import { useSection, saveSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { FieldRow } from "@/components/admin/FieldRow"
import { SaveButton } from "@/components/admin/SaveButton"

const SECTION = "siteSettings"

export default function SiteSettingsAdminPage() {
  const { data, setData, error } = useSection<any>(SECTION)

  const save = async () => {
    await saveSection(SECTION, data)
    toast.success("Settings saved")
  }

  if (!data) return <LoadState error={error} />

  const set = (k: string, v: any) => setData({ ...data, [k]: v })
  const vis = data.visibility ?? {}
  const setVis = (k: string, v: boolean) => setData({ ...data, visibility: { ...vis, [k]: v } })

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">System</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Site Settings</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>

      <ContentSection title="Site">
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Site name" value={data.siteName} onChange={(v) => set("siteName", v)} />
          <FieldRow
            label="Site URL"
            value={data.siteUrl}
            onChange={(v) => set("siteUrl", v)}
            dir="ltr"
            hint="Canonical URLs, sitemap and structured data all read this. No domain was supplied at intake, set the real one before launch."
          />
        </div>
        <label className="flex items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
          <input
            type="checkbox"
            checked={data.domainConfirmed === true}
            onChange={(e) => set("domainConfirmed", e.target.checked)}
            className="accent-[color:var(--primary)]"
          />
          Domain confirmed with the client
        </label>
      </ContentSection>

      <ContentSection
        title="Section visibility"
        description="A section also hides itself automatically when it has no content, so turning one on does not make an empty section appear."
      >
        <div className="space-y-3">
          {[
            { key: "contactForm", label: "Contact form" },
            { key: "pressSection", label: "Press section" },
            { key: "statsSection", label: "Results counters" },
            { key: "quoteSection", label: "Pull quote" },
          ].map((row) => (
            <label key={row.key} className="flex items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
              <input
                type="checkbox"
                checked={vis[row.key] !== false}
                onChange={(e) => setVis(row.key, e.target.checked)}
                className="accent-[color:var(--primary)]"
              />
              {row.label}
            </label>
          ))}
        </div>
      </ContentSection>

      <ContentSection title="Indexing">
        <p className="flex gap-2.5 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          <Info size={14} className="mt-0.5 shrink-0 text-[color:var(--primary)]" aria-hidden />
          <span>
            Search-engine indexing needs two things: a complete sign-off, and the NEXT_PUBLIC_ALLOW_INDEXING environment
            variable set to true at deploy time. The env flag is separate on purpose, a profile can be signed off for
            print or LinkedIn long before anyone decides the site itself should rank, so indexing is never a side effect
            of ticking a box in here.
          </span>
        </p>
      </ContentSection>

      <SaveButton onSave={save} />
    </div>
  )
}
