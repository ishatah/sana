"use client"

import { toast } from "sonner"
import { CheckCircle2, CircleDashed, ShieldAlert } from "@/components/admin/icons"
import { useSection, saveSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { FieldRow } from "@/components/admin/FieldRow"
import { SaveButton } from "@/components/admin/SaveButton"

const SECTION = "deliverables"

const STATUS_STYLE: Record<string, string> = {
  done: "text-[color:var(--success)]",
  ready: "text-[color:var(--primary-strong)]",
  blocked: "text-[color:var(--warning)]",
}

/**
 * Deliverables, open questions and sign-off — intake sections 16, 17 and 18.
 *
 * The sign-off block at the bottom is the single most consequential control in the
 * panel. Completing it removes the draft banner from every page and, together with
 * the NEXT_PUBLIC_ALLOW_INDEXING env flag, allows the site to be indexed.
 *
 * So it states that consequence next to the controls rather than in documentation
 * somewhere. Someone ticking four boxes should know what the fourth tick does; the
 * failure this prevents is a profile going live because the boxes looked like
 * routine record-keeping.
 */
export default function DeliverablesAdminPage() {
  const { data, setData, error } = useSection<any>(SECTION)

  const save = async () => {
    await saveSection(SECTION, data)
    toast.success("Deliverables saved")
  }

  if (!data) return <LoadState error={error} />

  const s = data.signOff ?? {}
  const setSignOff = (k: string, v: any) => setData({ ...data, signOff: { ...s, [k]: v } })

  const questions = data.openQuestions ?? []
  const updateQuestion = (i: number, patch: any) => {
    const next = [...questions]
    next[i] = { ...next[i], ...patch }
    setData({ ...data, openQuestions: next })
  }

  const cleared =
    Boolean(s.allTitlesConfirmed) &&
    Boolean(s.exclusionsConfirmed) &&
    Boolean(s.approvedForPublicationBy?.trim()) &&
    Boolean(s.clientReviewedOn?.trim())

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Intake sections 16, 17 and 18</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Deliverables &amp; Sign-off</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>

      <ContentSection title="Open questions" description="Record the answer and the date it was received in writing.">
        <div className="space-y-5">
          {questions.map((q: any, i: number) => {
            const answered = Boolean(q.answer?.trim())
            return (
              <div key={q.id} className="space-y-2.5 border-b border-[color:var(--border)] pb-5 last:border-0">
                <div className="flex items-start gap-2.5">
                  {answered ? (
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[color:var(--success)]" aria-hidden />
                  ) : (
                    <CircleDashed size={14} className="mt-0.5 shrink-0 text-[color:var(--muted-foreground)]" aria-hidden />
                  )}
                  <p className="text-sm text-[color:var(--card-foreground)]">
                    <span className="font-display font-bold text-[color:var(--primary-strong)]">{q.id.toUpperCase()}</span>{" "}
                    {q.question}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                  <FieldRow label="Answer" value={q.answer ?? ""} onChange={(v) => updateQuestion(i, { answer: v })} multiline />
                  <FieldRow
                    label="Answered on"
                    type="date"
                    value={q.answeredOn ?? ""}
                    onChange={(v) => updateQuestion(i, { answeredOn: v })}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </ContentSection>

      <ContentSection title="Deliverables" description="Production status against the intake form list.">
        <ul className="divide-y divide-[color:var(--border)]">
          {(data.items ?? []).map((item: any) => (
            <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
              <div>
                <p className="text-sm text-[color:var(--card-foreground)]">{item.output}</p>
                <p className="text-[0.7rem] text-[color:var(--muted-foreground)]">{item.targetLength}</p>
              </div>
              <span className={`font-display text-[0.7rem] uppercase tracking-widest ${STATUS_STYLE[item.status] ?? ""}`}>
                {item.status}
                {item.blockedOn ? ` · ${item.blockedOn}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </ContentSection>

      <ContentSection title="Sign-off" description="Intake section 18.">
        <div
          className={`mb-5 flex gap-2.5 border p-4 text-xs leading-relaxed ${
            cleared
              ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/12 text-[color:var(--card-foreground)]"
              : "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/12 text-[color:var(--muted-foreground)]"
          }`}
        >
          <ShieldAlert
            size={14}
            className={`mt-0.5 shrink-0 ${cleared ? "text-[color:var(--success)]" : "text-[color:var(--warning)]"}`}
            aria-hidden
          />
          <span>
            {cleared
              ? "Sign-off is complete. The draft banner is removed from every page, and the site may be indexed once NEXT_PUBLIC_ALLOW_INDEXING is set."
              : "Completing all four removes the draft banner from every page and allows the site to be indexed. Nothing is published until sections 15 and 18 are both complete."}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow
            label="Client reviewed the profile on"
            type="date"
            value={s.clientReviewedOn ?? ""}
            onChange={(v) => setSignOff("clientReviewedOn", v)}
          />
          <FieldRow
            label="Approved for publication by"
            value={s.approvedForPublicationBy ?? ""}
            onChange={(v) => setSignOff("approvedForPublicationBy", v)}
          />
        </div>

        <div className="space-y-3 pt-2">
          <label className="flex items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
            <input
              type="checkbox"
              checked={s.allTitlesConfirmed === true}
              onChange={(e) => setSignOff("allTitlesConfirmed", e.target.checked)}
              className="accent-[color:var(--primary)]"
            />
            All titles and positions confirmed
          </label>
          <label className="flex items-center gap-2.5 text-sm text-[color:var(--card-foreground)]">
            <input
              type="checkbox"
              checked={s.exclusionsConfirmed === true}
              onChange={(e) => setSignOff("exclusionsConfirmed", e.target.checked)}
              className="accent-[color:var(--primary)]"
            />
            Exclusions confirmed
          </label>
        </div>
      </ContentSection>

      <SaveButton onSave={save} />
    </div>
  )
}
