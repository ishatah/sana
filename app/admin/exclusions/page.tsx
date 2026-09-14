"use client"

import { toast } from "sonner"
import { Ban, Lock, ShieldAlert } from "@/components/admin/icons"
import { useSection, saveSection } from "@/components/admin/useSection"
import { LoadState } from "@/components/admin/LoadState"
import { ContentSection } from "@/components/admin/ContentSection"
import { SaveButton } from "@/components/admin/SaveButton"

const SECTION = "exclusions"

/**
 * The exclusions log — intake section 15.
 *
 * "Everything received but not used, with the reason. This protects the client and
 * us." That sentence is why this is a first-class page rather than a note in a
 * document: the log is what the API and the build gate read to decide which
 * wording can never appear in published copy, so the record and its enforcement
 * cannot drift apart.
 *
 * TWO CLASSES OF ITEM, RENDERED DIFFERENTLY:
 *
 *   Overridable — the client may insist in writing. The override is recorded here,
 *   and per the form's FINAL CHECK the item then goes in with the full organisation
 *   name and no diplomatic or United Nations wording. Those two rules are enforced
 *   in lib/verification.ts and an override cannot reach them.
 *
 *   Absolute — passport and national ID numbers, identity scans, home address, bank
 *   details, family details, and anything imitating a diplomatic, governmental or
 *   United Nations credential. These render with NO override control at all, rather
 *   than a disabled one. A switch that cannot be flipped invites someone to try;
 *   an absent switch says the decision was never theirs to make.
 */
export default function ExclusionsAdminPage() {
  const { data, setData, error } = useSection<any>(SECTION)

  const save = async () => {
    await saveSection(SECTION, data)
    toast.success("Exclusions log saved")
  }

  if (!data) return <LoadState error={error} />

  const items = data.items ?? []
  const never = data.neverPublished?.items ?? []

  const update = (i: number, patch: any) => {
    const next = [...items]
    next[i] = { ...next[i], ...patch }
    setData({ ...data, items: next })
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2">Intake section 15</p>
        <h1 className="font-display text-2xl font-bold text-[color:var(--heading)]">Exclusions Log</h1>
        <div className="mt-4 h-px bg-[color:var(--border)]" />
        <p className="mt-4 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          Everything received but not used, with the reason. This protects the client and us. Nothing here is shown on
          the public site.
        </p>
      </div>

      <ContentSection title="Excluded items">
        <div className="space-y-5">
          {items.map((item: any, i: number) => {
            const absolute = item.overrideAllowed === false
            return (
              <article
                key={item.id}
                className={`space-y-3 border p-5 ${
                  absolute
                    ? "border-[color:var(--danger)]/40 bg-[color:var(--danger)]/12"
                    : "border-[color:var(--border)] bg-[color:var(--background)]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {absolute ? (
                    <Lock size={15} className="mt-0.5 shrink-0 text-[color:var(--danger)]" aria-hidden />
                  ) : (
                    <Ban size={15} className="mt-0.5 shrink-0 text-[color:var(--warning)]" aria-hidden />
                  )}
                  <h3 className="font-display text-sm font-bold text-[color:var(--heading)]">{item.item}</h3>
                </div>

                <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">{item.reason?.en}</p>

                {item.blockedTerms?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.blockedTerms.map((term: string) => (
                      <span
                        key={term}
                        className="border border-[color:var(--border)] px-2 py-0.5 font-mono text-[0.65rem] text-[color:var(--muted-foreground)]"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-6 pt-1">
                  <label className="flex items-center gap-2.5 text-xs text-[color:var(--card-foreground)]">
                    <input
                      type="checkbox"
                      checked={item.informed === true}
                      onChange={(e) => update(i, { informed: e.target.checked })}
                      className="accent-[color:var(--primary)]"
                    />
                    Client informed
                  </label>

                  {absolute ? (
                    <span className="flex items-center gap-1.5 text-xs text-[color:var(--danger)]">
                      <Lock size={11} aria-hidden />
                      Never published — no override possible
                    </span>
                  ) : (
                    <label className="flex items-center gap-2.5 text-xs text-[color:var(--card-foreground)]">
                      <input
                        type="checkbox"
                        checked={item.override === true}
                        onChange={(e) => update(i, { override: e.target.checked })}
                        className="accent-[color:var(--warning)]"
                      />
                      Client override, in writing
                    </label>
                  )}
                </div>

                {item.override && !absolute && (
                  <p className="border-s-2 border-[color:var(--warning)] ps-3 text-[0.7rem] leading-relaxed text-[color:var(--warning)]">
                    Overridden. The item must be written in with the full organisation name and no diplomatic or United
                    Nations Peace Ambassadors Foundation wording. Those rules still apply and cannot be overridden.
                  </p>
                )}
              </article>
            )
          })}
        </div>
      </ContentSection>

      <ContentSection title="Never published, under any circumstance">
        <p className="mb-4 flex gap-2.5 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-[color:var(--danger)]" aria-hidden />
          <span>This list is fixed. No client instruction unlocks any of it.</span>
        </p>
        <ul className="space-y-1.5">
          {never.map((n: string) => (
            <li key={n} className="flex items-start gap-2 text-xs text-[color:var(--card-foreground)]">
              <Lock size={11} className="mt-1 shrink-0 text-[color:var(--danger)]" aria-hidden />
              {n}
            </li>
          ))}
        </ul>
      </ContentSection>

      <SaveButton onSave={save} />
    </div>
  )
}
