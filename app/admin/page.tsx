"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, CircleDashed, ShieldAlert } from "@/components/admin/icons"
import { fetchSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"

/**
 * The admin dashboard.
 *
 * It answers one question above all others: can this profile be published yet?
 * The intake form's FINAL CHECK says nothing is published until sections 15 and 18
 * are both complete, so the publication gate is the first thing on the page rather
 * than a status buried in a settings tab.
 *
 * Everything else here is the open-questions list from section 16, rendered as
 * work remaining. Six unanswered questions is not a failure state — it is the
 * normal condition of a file at intake, and the panel should read that way rather
 * than as an error screen.
 */
export default function AdminDashboard() {
  const [deliverables, setDeliverables] = useState<any>(null)
  const [positions, setPositions] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchSection("deliverables"), fetchSection("positions")])
      .then(([d, p]) => {
        setDeliverables(d)
        setPositions(p)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
  }, [])

  if (!deliverables || !positions) return <LoadState error={error} />

  const s = deliverables.signOff ?? {}
  const signOffChecks = [
    { label: "Client reviewed the profile", done: Boolean(s.clientReviewedOn?.trim()) },
    { label: "All titles and positions confirmed", done: Boolean(s.allTitlesConfirmed) },
    { label: "Exclusions confirmed", done: Boolean(s.exclusionsConfirmed) },
    { label: "Approved for publication", done: Boolean(s.approvedForPublicationBy?.trim()) },
  ]
  const cleared = signOffChecks.every((c) => c.done)

  const openQuestions = (deliverables.openQuestions ?? []).filter((q: any) => !q.answer?.trim())
  const missingAssets = (deliverables.mediaAssets ?? []).filter((a: any) => !a.received)
  const blockedItems = (deliverables.items ?? []).filter((i: any) => i.status === "blocked")
  const missingRegisters = (positions.current ?? []).filter((p: any) => p.publish && !p.registerConfirmed)

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Client CL-02-SR</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Sanae Rakik</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>

      {/* Publication gate */}
      <section
        className={`border p-6 ${
          cleared
            ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/12"
            : "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/12"
        }`}
      >
        <div className="mb-4 flex items-center gap-2.5">
          {cleared ? (
            <CheckCircle2 size={17} className="text-[color:var(--success)]" aria-hidden />
          ) : (
            <ShieldAlert size={17} className="text-[color:var(--warning)]" aria-hidden />
          )}
          <h2 className="font-display text-sm font-bold uppercase tracking-widest text-[color:var(--heading)]">
            {cleared ? "Cleared for publication" : "Not cleared for publication"}
          </h2>
        </div>

        <ul className="space-y-2">
          {signOffChecks.map((c) => (
            <li key={c.label} className="flex items-center gap-2.5 text-sm">
              {c.done ? (
                <CheckCircle2 size={14} className="shrink-0 text-[color:var(--success)]" aria-hidden />
              ) : (
                <CircleDashed size={14} className="shrink-0 text-[color:var(--muted-foreground)]" aria-hidden />
              )}
              <span className={c.done ? "text-[color:var(--card-foreground)]" : "text-[color:var(--muted-foreground)]"}>
                {c.label}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-5 border-t border-[color:var(--border)] pt-4 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          Nothing is published until sections 15 and 18 are both complete. While this is open, the site shows a draft
          banner and is excluded from search engines.
        </p>

        <Link href="/admin/deliverables" className="btn-outline mt-5">
          Open sign-off
        </Link>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <StatCard
          title="Open questions"
          count={openQuestions.length}
          href="/admin/deliverables"
          items={openQuestions.map((q: any) => `${q.id.toUpperCase()} — ${q.question}`)}
        />
        <StatCard
          title="Media assets outstanding"
          count={missingAssets.length}
          href="/admin/media"
          items={missingAssets.map((a: any) => a.asset)}
        />
        <StatCard
          title="Deliverables blocked"
          count={blockedItems.length}
          href="/admin/deliverables"
          items={blockedItems.map((i: any) => `${i.output} — blocked on ${i.blockedOn}`)}
        />
        <StatCard
          title="Register entries needed"
          count={missingRegisters.length}
          href="/admin/positions"
          items={missingRegisters.map((p: any) => p.organisation)}
        />
      </div>
    </div>
  )
}

function StatCard({ title, count, href, items }: { title: string; count: number; href: string; items: string[] }) {
  return (
    <section className="border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xs font-bold uppercase tracking-widest text-[color:var(--heading)]">{title}</h3>
        <span
          className={`font-display text-xl font-bold ${
            count > 0 ? "text-[color:var(--warning)]" : "text-[color:var(--success)]"
          }`}
        >
          {count}
        </span>
      </div>

      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {/* Capped at four with a remainder count — the whole point of this card
              is a glance, and a card that grows to fourteen rows stops being one. */}
          {items.slice(0, 4).map((item, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
              <AlertTriangle size={11} className="mt-1 shrink-0 text-[color:var(--warning)]/70" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
          {items.length > 4 && (
            <li className="ps-5 text-xs text-[color:var(--muted-foreground)]">+{items.length - 4} more</li>
          )}
        </ul>
      ) : (
        <p className="text-xs text-[color:var(--muted-foreground)]">Nothing outstanding.</p>
      )}

      <Link href={href} className="mt-4 inline-block text-[0.7rem] uppercase tracking-widest text-[color:var(--primary-strong)] hover:underline">
        Open
      </Link>
    </section>
  )
}
