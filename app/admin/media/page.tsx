"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, CircleDashed, Info, Lock, Upload, X } from "@/components/admin/icons"
import { useSection, saveSection, fetchSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { FieldRow } from "@/components/admin/FieldRow"
import { LocalizedFieldRow } from "@/components/admin/LocalizedFieldRow"
import { SaveButton } from "@/components/admin/SaveButton"

const CHECKLIST_SECTION = "deliverables"
const MEDIA_SECTION = "media"

/**
 * Media assets, intake section 14, in two halves.
 *
 * The top half is the checklist from the form: what was asked for and what has arrived.
 * The bottom half is the slots that actually render on the site.
 *
 * THE PERMISSION FIELDS SIT ABOVE THE FILE INPUT ON EVERY SLOT, and the input is
 * disabled until permission is recorded and saved. That ordering is the whole design of
 * this page. Holding a logo file is not the same as having the right to publish it, and
 * three organisations are involved here, using an association's mark on a personal
 * profile without its agreement damages the relationship the profile exists to
 * represent. A form that takes the file first and asks about rights afterwards gets the
 * file uploaded and the question forgotten.
 *
 * The API refuses the upload too (422), so this is not the only guard, but a disabled
 * input that explains itself is better than a rejection after the fact.
 */
export default function MediaAdminPage() {
  const { data, setData, error } = useSection<any>(CHECKLIST_SECTION)
  const { data: media, setData: setMedia, error: mediaError } = useSection<any>(MEDIA_SECTION)
  const [busy, setBusy] = useState<string | null>(null)

  const saveChecklist = async () => {
    await saveSection(CHECKLIST_SECTION, data)
    toast.success("Media checklist saved")
  }

  const saveMedia = async () => {
    await saveSection(MEDIA_SECTION, media)
    toast.success("Media slots saved")
  }

  if (!data || !media) return <LoadState error={error ?? mediaError} />

  const assets = data.mediaAssets ?? []
  const updateAsset = (i: number, patch: any) => {
    const next = [...assets]
    next[i] = { ...next[i], ...patch }
    setData({ ...data, mediaAssets: next })
  }

  const slots = media.slots ?? []
  const updateSlot = (i: number, patch: any) => {
    const next = [...slots]
    next[i] = { ...next[i], ...patch }
    setMedia({ ...media, slots: next })
  }

  const upload = async (slotId: string, file: File) => {
    setBusy(slotId)
    try {
      const body = new FormData()
      body.append("slotId", slotId)
      body.append("file", file)
      const res = await fetch("/api/admin/media", { method: "POST", body })
      const json = await res.json().catch(() => ({}) as any)

      if (!res.ok) {
        // The 422 and 503 bodies carry a `reason` explaining what to do about it.
        throw new Error([json.error, json.reason].filter(Boolean).join(" "))
      }

      setMedia(await fetchSection(MEDIA_SECTION))
      toast.success("File uploaded")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(null)
    }
  }

  const detach = async (slotId: string) => {
    setBusy(slotId)
    try {
      const res = await fetch(`/api/admin/media?slotId=${encodeURIComponent(slotId)}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}) as any)
        throw new Error(json.error ?? "Could not detach the file")
      }
      setMedia(await fetchSection(MEDIA_SECTION))
      toast.success("File detached: the stored copy is kept for the record")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Intake section 14</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Media Assets</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>

      <ContentSection title="Assets received">
        <p className="mb-5 flex gap-2.5 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          <Info size={14} className="mt-0.5 shrink-0 text-[color:var(--primary)]" aria-hidden />
          <span>
            Only tier A or B certificates may be cleared for display. Logos need the owning organisation&rsquo;s
            permission, not just the file.
          </span>
        </p>

        <div className="space-y-4">
          {assets.map((a: any, i: number) => (
            <div key={a.id} className="space-y-3 border-b border-[color:var(--border)] pb-4 last:border-0">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={a.received === true}
                  onChange={(e) => updateAsset(i, { received: e.target.checked })}
                  className="mt-1 accent-[color:var(--primary)]"
                />
                <span className="flex items-center gap-2 text-sm text-[color:var(--card-foreground)]">
                  {a.received ? (
                    <CheckCircle2 size={14} className="text-[color:var(--success)]" aria-hidden />
                  ) : (
                    <CircleDashed size={14} className="text-[color:var(--muted-foreground)]" aria-hidden />
                  )}
                  {a.asset}
                </span>
              </label>
              <FieldRow label="Notes" value={a.notes ?? ""} onChange={(v) => updateAsset(i, { notes: v })} />
            </div>
          ))}
        </div>

        <SaveButton onSave={saveChecklist} />
      </ContentSection>

      <ContentSection
        title="Slots on the site"
        description="Each slot renders in one place on the public page. A slot appears only once it has a file, a recorded permission and alt text, until then the site renders its built fallback."
      >
        <div className="space-y-8">
          {slots.map((s: any, i: number) => {
            const granted = s.permission?.granted === true
            const hasFile = Boolean(s.path)
            const uploading = busy === s.id

            return (
              <div key={s.id} className="space-y-4 border-b border-[color:var(--border)] pb-8 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[color:var(--heading)]">
                    {s.id}
                  </h3>
                  <span
                    className={`text-[0.7rem] uppercase tracking-widest ${
                      hasFile && granted
                        ? "text-[color:var(--success)]"
                        : "text-[color:var(--muted-foreground)]"
                    }`}
                  >
                    {hasFile && granted ? "Live" : granted ? "Cleared, no file" : "Not cleared"}
                  </span>
                </div>

                {/* Permission, first. */}
                <div
                  className={`space-y-3 border-s-2 ps-4 ${
                    granted ? "border-[color:var(--success)]/40" : "border-[color:var(--warning)]/40"
                  }`}
                >
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={granted}
                      onChange={(e) =>
                        updateSlot(i, { permission: { ...(s.permission ?? {}), granted: e.target.checked } })
                      }
                      className="mt-1 accent-[color:var(--primary)]"
                    />
                    <span className="text-sm text-[color:var(--card-foreground)]">
                      Permission to publish has been given in writing
                    </span>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldRow
                      label="Granted by"
                      value={s.permission?.grantedBy ?? ""}
                      onChange={(v) => updateSlot(i, { permission: { ...(s.permission ?? {}), grantedBy: v } })}
                      hint="The rights holder: for a photograph this is often the photographer, not the subject."
                    />
                    <FieldRow
                      label="Granted on"
                      type="date"
                      value={s.permission?.grantedOn ?? ""}
                      onChange={(v) => updateSlot(i, { permission: { ...(s.permission ?? {}), grantedOn: v } })}
                    />
                    <FieldRow
                      label="Scope"
                      value={s.permission?.scope ?? ""}
                      onChange={(v) => updateSlot(i, { permission: { ...(s.permission ?? {}), scope: v } })}
                      hint="What the grant covers: website only, all deliverables, and so on."
                    />
                    <FieldRow
                      label="Source"
                      value={s.permission?.source ?? ""}
                      onChange={(v) => updateSlot(i, { permission: { ...(s.permission ?? {}), source: v } })}
                      hint="Where the file and the grant came from, so it can be traced back."
                    />
                  </div>
                </div>

                {/* Then the file. */}
                <div className="space-y-2">
                  {hasFile ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <code className="min-w-0 flex-1 truncate text-xs text-[color:var(--muted-foreground)]">
                        {s.path}
                      </code>
                      <button
                        type="button"
                        onClick={() => detach(s.id)}
                        disabled={uploading}
                        className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-widest text-[color:var(--danger)] disabled:opacity-50"
                      >
                        <X size={12} aria-hidden />
                        Detach
                      </button>
                    </div>
                  ) : (
                    <label
                      className={`inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-widest ${
                        granted
                          ? "cursor-pointer text-[color:var(--primary-strong)]"
                          : "cursor-not-allowed text-[color:var(--muted-foreground)]"
                      }`}
                    >
                      {granted ? <Upload size={13} aria-hidden /> : <Lock size={13} aria-hidden />}
                      {uploading ? "Uploading…" : granted ? "Choose a file" : "Record permission first"}
                      <input
                        type="file"
                        // Rasters only, matching the server allowlist in
                        // app/api/admin/media/route.ts. SVG was dropped from both;
                        // see the note there. This attribute is a file-picker
                        // convenience, not the enforcement, the route is.
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        disabled={!granted || uploading}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) upload(s.id, f)
                          e.target.value = ""
                        }}
                      />
                    </label>
                  )}

                  {!granted && (
                    <p className="text-[0.7rem] leading-relaxed text-[color:var(--muted-foreground)]">
                      Save the permission above before uploading. Open question Q5 covers the portrait and the
                      organisation logos.
                    </p>
                  )}
                </div>

                <LocalizedFieldRow
                  label="Alt text"
                  value={s.alt}
                  onChange={(next) => updateSlot(i, { alt: next })}
                  hint="Required. A slot with no alt text in any language does not render, an image nobody has described is an image nobody has checked."
                />

                <FieldRow
                  label="Credit line"
                  value={s.credit ?? ""}
                  onChange={(v) => updateSlot(i, { credit: v })}
                  hint="Shown under the image. Required where the grant carries an attribution condition."
                />
              </div>
            )
          })}
        </div>

        <SaveButton onSave={saveMedia} />
      </ContentSection>
    </div>
  )
}
