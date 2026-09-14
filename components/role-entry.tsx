import { getLocale, getTranslations } from "next-intl/server"
import { localize, type LocalizedString } from "@/lib/localize"
import type { Position, Membership } from "@/lib/profile-content"

/**
 * One organisation, one entry — however many records describe it.
 *
 * THIS EXISTS BECAUSE THE DATA SPLITS WHAT THE READER DOES NOT.
 *
 * `positions.current` and `awards.memberships` are separate files describing
 * separate kinds of relationship, and for the previous subject they genuinely
 * were: six federation roles and two awards from other bodies entirely. For this
 * subject both lists contain exactly one row, and it is the SAME organisation —
 * the International Business Council, once as the post she holds and once as the
 * body she is affiliated with.
 *
 * Rendering the two lists one after another printed "International Business
 * Council (IBC)" twice on one page, under two headings, describing one job. That
 * reads as padding, and on a profile whose whole argument is precision it reads as
 * padding that was not noticed.
 *
 * So the merge happens at the point of render rather than in the data: the files
 * keep their separate shapes (a membership has a period, a position has start and
 * end years and a city), and this component composes whichever facets exist for a
 * given organisation into a single entry.
 *
 * MATCHED ON `organisation`, NOT ON ID. The two files were authored independently
 * and their ids do not correspond — `ibc-consultant` against `ibc-membership`.
 * The organisation name is the thing they genuinely share, and it is a plain
 * string in both files precisely so it survives comparison unmodified.
 */

export interface ComposedRole {
  key: string
  organisation: string
  organisationUrl?: string
  /** From whichever record carries it; the position wins if both do. */
  role: LocalizedString
  summary?: LocalizedString
  city?: LocalizedString
  startYear?: string
  endYear?: string
  period?: string
}

/**
 * Fold positions and memberships into one list, keyed by organisation name.
 *
 * Order follows `positions` first, because a held post is the stronger statement
 * of the two; a membership with no matching position is appended after.
 */
export function composeRoles(positions: Position[], memberships: Membership[]): ComposedRole[] {
  const byOrg = new Map<string, ComposedRole>()

  for (const p of positions) {
    if (!p.organisation?.trim()) continue
    byOrg.set(p.organisation, {
      key: p.id,
      organisation: p.organisation,
      organisationUrl: p.organisationUrl || undefined,
      role: p.role,
      city: p.city,
      startYear: p.startYear,
      endYear: p.endYear,
    })
  }

  for (const m of memberships) {
    if (!m.organisation?.trim()) continue
    const existing = byOrg.get(m.organisation)
    if (existing) {
      // Same organisation: contribute only what the position record lacks. The
      // role is NOT overwritten — a position's own title is the authoritative one.
      existing.summary = existing.summary ?? m.summary
      existing.period = existing.period ?? m.period
      existing.organisationUrl = existing.organisationUrl ?? (m.organisationUrl || undefined)
    } else {
      byOrg.set(m.organisation, {
        key: m.id,
        organisation: m.organisation,
        organisationUrl: m.organisationUrl || undefined,
        role: m.role,
        summary: m.summary,
        period: m.period,
      })
    }
  }

  return [...byOrg.values()]
}

export async function RoleEntryList({ roles }: { roles: ComposedRole[] }) {
  const locale = await getLocale()
  const t = await getTranslations("positions")

  return (
    <div className="max-w-4xl">
      {/* `.thread-steps` indents each row slightly further than the last, capped at
          three steps. Desktop only — see styles/globals.css. */}
      <ul className="thread-steps space-y-5">
        {roles.map((r) => (
          <li key={r.key} data-anime="rail-item">
            <article className="panel-3d p-6 sm:p-7">
              <h3 className="mb-1.5 font-display text-lg font-bold leading-snug text-[color:var(--heading)]">
                {localize(r.role, locale)}
              </h3>

              {/* The full legal name. `break-words` rather than `truncate`: these
                  names are long by nature and clipping one would defeat the point
                  of naming the organisation in full. */}
              <p className="text-sm leading-relaxed text-[color:var(--primary-strong)] break-words">
                {r.organisation}
              </p>

              {r.summary && localize(r.summary, locale) && (
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                  {localize(r.summary, locale)}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[color:var(--muted-foreground)]">
                {localize(r.city, locale) && <span>{localize(r.city, locale)}</span>}

                {/*
                  THE DATE STATE IS NEVER GUESSED, AND NEVER SILENT.

                  Intake section 4 records the IBC start date as "يُزوَّد لاحقًا"
                  and the membership period likewise. An entry with neither would
                  otherwise render no date at all, which a reader takes as "undated"
                  rather than "pending" — so the absence is stated in words.

                  A start year is preferred to a period when both exist: it is the
                  more precise of the two.
                */}
                {r.startYear ? (
                  <span>
                    {t("since")} {r.startYear}
                    {r.endYear ? ` – ${r.endYear}` : ""}
                  </span>
                ) : r.period ? (
                  <span>{r.period}</span>
                ) : (
                  <span className="italic text-[color:var(--warning)]/80">{t("sinceUnconfirmed")}</span>
                )}

                {r.organisationUrl && (
                  <a
                    href={r.organisationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-4 transition-colors hover:text-[color:var(--primary)]"
                  >
                    {t("visitSite")}
                  </a>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  )
}
