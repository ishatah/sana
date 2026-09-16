"use client"

import { toast } from "sonner"
import { AlertTriangle, Plus, Trash2 } from "@/components/admin/icons"
import { useSection, saveSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { FieldRow } from "@/components/admin/FieldRow"
import { LocalizedFieldRow } from "@/components/admin/LocalizedFieldRow"
import { emptyLocalized } from "@/components/admin/emptyLocalized"
import { SaveButton } from "@/components/admin/SaveButton"

const SECTION = "positions"

/**
 * The positions editor.
 *
 * The tier control is the reason this page exists in this shape. The intake form
 * says the tier "is set by us, not by the client", and it decides whether a row
 * is publishable at all, so it is a labelled control with its meaning written
 * next to it, not a bare letter in a dropdown that a hurried editor sets to A to
 * make a warning go away.
 *
 * Choosing C visibly disables the publish toggle and says why. The alternative,
 * letting both be set and resolving the contradiction silently at render, means
 * the panel shows a row as published while the site correctly refuses to render
 * it, and the editor has no way to see the disagreement.
 */
const TIER_HELP: Record<string, string> = {
  A: "Accredited or officially registered body, verifiable in a public register. Publish freely.",
  B: "Real organisation, role confirmed by the client, limited public record. Publish with the full organisation name and no inflated wording.",
  C: "Title-selling outfit, unregistered body, or a name that imitates an official institution. Never published, log it in the exclusions log instead.",
}

export default function PositionsAdminPage() {
  const { data, setData, error } = useSection<any>(SECTION)

  const save = async () => {
    await saveSection(SECTION, data)
    toast.success("Positions saved")
  }

  if (!data) return <LoadState error={error} />

  const current = data.current ?? []

  const update = (index: number, patch: Record<string, any>) => {
    const next = [...current]
    next[index] = { ...next[index], ...patch }
    setData({ ...data, current: next })
  }

  const add = () => {
    setData({
      ...data,
      current: [
        ...current,
        {
          id: `position-${Date.now()}`,
          organisation: "",
          organisationUrl: "",
          registerConfirmed: false,
          role: emptyLocalized(),
          city: emptyLocalized(),
          startYear: "",
          // A new row starts at C and unpublished. The safe default is the one
          // that keeps an unverified entry off the site until someone actively
          // assesses it, the opposite default publishes anything half-entered.
          tier: "C",
          publish: false,
          condition: "",
        },
      ],
    })
  }

  const remove = (index: number) => {
    setData({ ...data, current: current.filter((_: any, i: number) => i !== index) })
  }

  return (
    <div className="space-y-7">
      <Header />

      {current.map((p: any, i: number) => {
        const tierC = p.tier === "C"
        return (
          <ContentSection key={p.id ?? i} title={p.organisation || "Untitled position"}>
            <div className="space-y-5">
              <FieldRow
                label="Organisation: full legal name"
                value={p.organisation}
                onChange={(v) => update(i, { organisation: v })}
                hint="Written out in full everywhere it appears. Never abbreviated, never shortened to an acronym on its own."
              />

              <LocalizedFieldRow label="Role / title" value={p.role} onChange={(v) => update(i, { role: v })} />
              <LocalizedFieldRow label="City, country" value={p.city} onChange={(v) => update(i, { city: v })} />

              <div className="grid gap-3 sm:grid-cols-3">
                <FieldRow label="Start year" value={p.startYear ?? ""} onChange={(v) => update(i, { startYear: v })} />
                <FieldRow label="End year" value={p.endYear ?? ""} onChange={(v) => update(i, { endYear: v })} />
                <FieldRow
                  label="Website / register URL"
                  value={p.organisationUrl ?? ""}
                  onChange={(v) => update(i, { organisationUrl: v })}
                  dir="ltr"
                />
              </div>

              {/* Verification tier */}
              <div className="space-y-2 border border-[color:var(--border)] bg-[color:var(--background)] p-4">
                <label className="block text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)]">
                  Verification tier: set by the studio, not the client
                </label>
                <div className="flex gap-2">
                  {(["A", "B", "C"] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => update(i, { tier, ...(tier === "C" ? { publish: false } : {}) })}
                      className={`h-9 w-12 border font-display text-sm font-bold transition-colors ${
                        p.tier === tier
                          ? tier === "C"
                            ? "border-[color:var(--danger)] bg-[color:var(--danger)]/15 text-[color:var(--danger)]"
                            : "border-[color:var(--primary)] bg-[color:var(--primary)]/15 text-[color:var(--primary-strong)]"
                          : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--heading)]"
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
                <p className="text-[0.7rem] leading-relaxed text-[color:var(--muted-foreground)]">
                  {TIER_HELP[p.tier] ?? "Choose a tier."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
                  <input
                    type="checkbox"
                    checked={p.publish === true && !tierC}
                    disabled={tierC}
                    onChange={(e) => update(i, { publish: e.target.checked })}
                    className="accent-[color:var(--primary)] disabled:opacity-40"
                  />
                  Publish on the site
                  {tierC && <span className="text-xs text-[color:var(--danger)]">- tier C is never published</span>}
                </label>

                <label className="flex items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
                  <input
                    type="checkbox"
                    checked={p.registerConfirmed === true}
                    onChange={(e) => update(i, { registerConfirmed: e.target.checked })}
                    className="accent-[color:var(--primary)]"
                  />
                  Public register entry confirmed
                </label>
              </div>

              {/* Disclaimer. Rendered directly under
                  it on the public page. */}
              <LocalizedFieldRow
                label="Disclaimer shown under this position"
                value={p.disclaimer}
                onChange={(v) => update(i, { disclaimer: v })}
                multiline
                hint="Use when the organisation's name could be mistaken for an official institution. It renders immediately below the row on the public page, not in a footnote."
              />

              <button
                type="button"
                onClick={() => remove(i)}
                className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--danger)]"
              >
                <Trash2 size={12} aria-hidden />
                Remove position
              </button>
            </div>
          </ContentSection>
        )
      })}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={add} className="btn-outline">
          <Plus size={15} aria-hidden />
          Add position
        </button>
        <SaveButton onSave={save} />
      </div>
    </div>
  )
}

function Header() {
  return (
    <div>
      <p className="eyebrow mb-2">Intake section 3</p>
      <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Positions</h1>
      <div className="mt-4 h-px bg-[color:var(--border)]" />
      <p className="mt-4 flex gap-2.5 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[color:var(--warning)]" aria-hidden />
        <span>
          A save is rejected if the copy implies a diplomatic, governmental or United Nations credential. Write every
          organisation name out in full.
        </span>
      </p>
    </div>
  )
}
