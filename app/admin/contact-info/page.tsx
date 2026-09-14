"use client"

import { toast } from "sonner"
import { Eye, EyeOff, HelpCircle, ShieldAlert } from "@/components/admin/icons"
import { useSection, saveSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { FieldRow } from "@/components/admin/FieldRow"
import { SaveButton } from "@/components/admin/SaveButton"

const SECTION = "siteSettings"

type Visibility = "public" | "internal" | "to-confirm"

const VIS: { value: Visibility; label: string; icon: typeof Eye; hint: string }[] = [
  { value: "public", label: "Public", icon: Eye, hint: "Rendered on the website." },
  { value: "internal", label: "Internal", icon: EyeOff, hint: "Our file only. Never rendered." },
  { value: "to-confirm", label: "To confirm", icon: HelpCircle, hint: "Withheld until she answers Q6 in writing." },
]

/**
 * Contact details.
 *
 * Three visibility states rather than a public/private switch. "To confirm" is
 * genuinely distinct from "internal": both are withheld today, but an internal
 * line stays internal forever while a to-confirm line is waiting on an answer and
 * belongs on the outstanding-questions list. Collapsing the two would quietly turn
 * six unanswered questions into six settled decisions.
 *
 * Addresses default to withheld and carry the strongest warning, because intake
 * section 6 forbids publishing a home address and no office address was supplied
 * has been confirmed as an office rather than a residence.
 */
export default function ContactAdminPage() {
  const { data, setData, error } = useSection<any>(SECTION)

  const save = async () => {
    await saveSection(SECTION, data)
    toast.success("Contact details saved")
  }

  if (!data) return <LoadState error={error} />

  const c = data.contact ?? {}
  const setContact = (k: string, v: any) => setData({ ...data, contact: { ...c, [k]: v } })

  const updateIn = (key: "emails" | "phones" | "addresses", i: number, patch: any) => {
    const list = [...(c[key] ?? [])]
    list[i] = { ...list[i], ...patch }
    setContact(key, list)
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Intake section 13</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Contact</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>

      <ContentSection title="Email addresses">
        {(c.emails ?? []).map((e: any, i: number) => (
          <div key={e.id} className="space-y-3 border-b border-[color:var(--border)] pb-5 last:border-0">
            <FieldRow label="Address" value={e.address} onChange={(v) => updateIn("emails", i, { address: v })} dir="ltr" />
            <VisibilityPicker value={e.visibility} onChange={(v) => updateIn("emails", i, { visibility: v })} />
            <label className="flex items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
              <input
                type="checkbox"
                checked={e.primary === true}
                onChange={(ev) => {
                  // Exactly one primary. Setting one clears the rest — two primary
                  // addresses is not a state the contact block can render.
                  const list = (c.emails ?? []).map((x: any, idx: number) => ({ ...x, primary: idx === i && ev.target.checked }))
                  setContact("emails", list)
                }}
                className="accent-[color:var(--primary)]"
              />
              Primary contact address
            </label>
          </div>
        ))}
      </ContentSection>

      <ContentSection
        title="Phone numbers"
        description="Open question Q6 — which numbers may be published. Both are withheld until answered."
      >
        {(c.phones ?? []).map((p: any, i: number) => (
          <div key={p.id} className="space-y-3 border-b border-[color:var(--border)] pb-5 last:border-0">
            <FieldRow label="Number" value={p.number} onChange={(v) => updateIn("phones", i, { number: v })} dir="ltr" />
            <VisibilityPicker value={p.visibility} onChange={(v) => updateIn("phones", i, { visibility: v })} />
          </div>
        ))}
      </ContentSection>

      <ContentSection title="Office addresses" description="No address is published. Intake section 6 forbids the home address and records no office.">
        <p className="mb-5 flex gap-2.5 border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/12 p-4 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-[color:var(--danger)]" aria-hidden />
          <span>
            A home address is never published. Confirm an address is a business premises before making it public, and
            present only one as the head office. While both are withheld the contact block shows the city alone.
          </span>
        </p>

        {(c.addresses ?? []).map((a: any, i: number) => (
          <div key={a.id} className="space-y-3 border-b border-[color:var(--border)] pb-5 last:border-0">
            <FieldRow label="Address" value={a.address} onChange={(v) => updateIn("addresses", i, { address: v })} multiline />
            <VisibilityPicker value={a.visibility} onChange={(v) => updateIn("addresses", i, { visibility: v })} />
            <label className="flex items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
              <input
                type="checkbox"
                checked={a.isHeadOffice === true}
                onChange={(ev) => {
                  const list = (c.addresses ?? []).map((x: any, idx: number) => ({
                    ...x,
                    isHeadOffice: idx === i && ev.target.checked,
                  }))
                  setContact("addresses", list)
                }}
                className="accent-[color:var(--primary)]"
              />
              Head office
            </label>
          </div>
        ))}
      </ContentSection>

      <SaveButton onSave={save} />
    </div>
  )
}

function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  const active = VIS.find((v) => v.value === value)
  return (
    <div className="space-y-2">
      <label className="block text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)]">Visibility</label>
      <div className="flex flex-wrap gap-2">
        {VIS.map((v) => {
          const Icon = v.icon
          const on = value === v.value
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => onChange(v.value)}
              className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs transition-colors ${
                on
                  ? v.value === "public"
                    ? "border-[color:var(--success)] bg-[color:var(--success)]/10 text-[color:var(--success)]"
                    : "border-[color:var(--warning)] bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
                  : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--heading)]"
              }`}
            >
              <Icon size={12} aria-hidden />
              {v.label}
            </button>
          )
        })}
      </div>
      {active && <p className="text-[0.7rem] text-[color:var(--muted-foreground)]">{active.hint}</p>}
    </div>
  )
}
