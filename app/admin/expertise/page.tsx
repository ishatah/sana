"use client"

import { toast } from "sonner"
import { Plus, Trash2 } from "@/components/admin/icons"
import { useSection, saveSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { LocalizedFieldRow } from "@/components/admin/LocalizedFieldRow"
import { emptyLocalized } from "@/components/admin/emptyLocalized"
import { SaveButton } from "@/components/admin/SaveButton"

const SECTION = "expertise"

/**
 * The areas of expertise.
 *
 * TWO FIELDS PER AREA. The title is a short noun phrase, per the intake form.
 * The supporting line beneath it is one sentence saying what the area consists
 * of, and it is OPTIONAL: an area with none renders as the phrase alone.
 *
 * Both are rendered by components/expertise-grid.tsx and nothing else.
 *
 * The supporting lines currently in data/expertise.json are transcribed from the
 * supplied profile rather than written for the site, see that file's
 * `_comment_detail`. Anything typed here is published as written, so a new line
 * should come from something the client has confirmed in writing, and must not
 * introduce a figure: intake section 3 forbids unverifiable numbers and ratios.
 */
export default function ExpertiseAdminPage() {
  const { data, setData, error } = useSection<any>(SECTION)

  const save = async () => {
    await saveSection(SECTION, data)
    toast.success("Expertise saved")
  }

  if (!data) return <LoadState error={error} />

  const items = data.items ?? []

  const updateItem = (i: number, patch: any) => {
    const next = [...items]
    next[i] = { ...next[i], ...patch }
    setData({ ...data, items: next })
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Intake section 5</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Expertise</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>

      <ContentSection
        title="Areas of expertise"
        description="Five to eight short noun phrases, each with an optional one-sentence supporting line. Keep the supporting line to a single sentence: the grid is four columns wide and the cells size themselves to the longest one."
      >
        {items.map((item: any, i: number) => (
          <div key={item.id} className="space-y-2 border-b border-[color:var(--border)] pb-5 last:border-0">
            <LocalizedFieldRow label={`Area ${i + 1}`} value={item.title} onChange={(v) => updateItem(i, { title: v })} />
            {/* Optional. Clearing it renders the phrase alone, which is what the
                grid did before this field existed, so there is no broken state to
                fall into here. */}
            <LocalizedFieldRow
              label={`Area ${i + 1} — supporting line`}
              value={item.detail}
              onChange={(v) => updateItem(i, { detail: v })}
            />
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

      <SaveButton onSave={save} />
    </div>
  )
}

