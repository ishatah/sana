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
 * Short noun phrases only, per the intake form. The public grid in
 * components/expertise-grid.tsx renders these and nothing else.
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

      <SaveButton onSave={save} />
    </div>
  )
}

