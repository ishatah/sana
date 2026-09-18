import { getLocale, getTranslations } from "next-intl/server"
import { localize, type LocalizedString } from "@/lib/localize"
import type { Position, Membership } from "@/lib/profile-content"
/* The reading rail is a client component rendered from this server one. It owns
   the <ul> and takes the rows as children, it needs a ref on the LIST, because
   reading progress is measured against the rows rather than against the rail.
   Every row below is still rendered and localized here, on the server. */
import { LedgerRail } from "@/components/motion/fm/ledger-rail"

/**
 * One organisation, one entry, however many records describe it.
 *
 * THIS EXISTS BECAUSE THE DATA SPLITS WHAT THE READER DOES NOT.
 *
 * `positions.current` and `awards.memberships` are separate files describing
 * separate kinds of relationship, and for the previous subject they genuinely
 * were: six federation roles and two awards from other bodies entirely. For this
 * subject both lists contain exactly one row, and it is the SAME organisation,
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
 * and their ids do not correspond, `ibc-consultant` against `ibc-membership`.
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
  /**
   * Whether this organisation's entry has been confirmed in a public register.
   *
   * CARRIED FROM `Position` ONLY, and defaulting to false rather than to undefined
   * wherever it is absent. A membership record has no such field, awards.json
   * does not carry one, so an entry composed from a membership alone is unconfirmed
   * by construction, which is the correct reading: nobody has checked it.
   *
   * This is the field the verification mark renders. It must never be inferred
   * from anything else: a row can be publishable (tier A or B, publish:true) and
   * still have `registerConfirmed: false`, and conflating the two would put a
   * confirmation mark on an entry nobody has verified. That is precisely the
   * fabrication lib/verification.ts exists to prevent.
   */
  registerConfirmed: boolean
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
      // `=== true` rather than a truthy read: the field is optional on Position,
      // and an absent one must land as false, never as undefined leaking into the
      // mark's state test.
      registerConfirmed: p.registerConfirmed === true,
    })
  }

  for (const m of memberships) {
    if (!m.organisation?.trim()) continue
    const existing = byOrg.get(m.organisation)
    if (existing) {
      // Same organisation: contribute only what the position record lacks. The
      // role is NOT overwritten, a position's own title is the authoritative one.
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
        // A membership carries no register confirmation, see the field note on
        // ComposedRole. Unconfirmed is the honest default, not a placeholder.
        registerConfirmed: false,
      })
    }
  }

  return [...byOrg.values()]
}

/**
 * The register-verification mark.
 *
 * ── THE MARK IS COMPLETE BEFORE ANY SCRIPT RUNS ────────────────────────────────
 *
 * Both paths are rendered at full opacity with no dash applied. The interaction
 * layer (`verifyMarks` in components/motion/interactions.ts) hides and redraws
 * them only once it is certain it can finish the job, the same from-state-in-JS
 * discipline components/motion/hero.ts documents at length. A visitor with no
 * scripting, or with reduced motion, sees the finished mark rather than an empty
 * box, and the distinction it encodes survives intact.
 *
 * ── THE MEANING IS IN TEXT, NOT IN THE DRAWING ─────────────────────────────────
 *
 * `<title>` inside the SVG gives the mark an accessible name, and `role="img"`
 * makes it one node rather than a pile of anonymous paths. A screen reader gets
 * the full sentence; a sighted reader gets the mark. Neither depends on the
 * animation, which is what allows the animation to exist at all.
 *
 * Colour alone never carries the state either, confirmed draws a tick, pending
 * draws a bare open rule. Two different SHAPES, per WCAG 1.4.1.
 */
function VerifyMark({ confirmed, label }: { confirmed: boolean; label: string }) {
  return (
    <svg
      data-verify={confirmed ? "confirmed" : "pending"}
      role="img"
      aria-label={label}
      viewBox="0 0 28 16"
      // `mark-settle` lets the tick arrive slightly reduced and settle on entry.
      // It scales from 0.88 rather than from 0, data/exclusions.json logs the
      // intake ban on `العناصر الحركية الزائدة`, and a mark that pops into
      // existence is exactly that register. This is a settle, not an entrance.
      className="mark-settle stroke-draw h-4 w-7 shrink-0 overflow-visible"
      fill="none"
      stroke={confirmed ? "var(--primary)" : "var(--muted-foreground)"}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>{label}</title>
      {/*
        The rule. Shorter when pending, and deliberately left OPEN-ENDED, it
        stops rather than closing into anything, which is the visual statement
        that the record is still in progress.
      */}
      <path data-verify-rule d={confirmed ? "M1 12 H27" : "M1 12 H15"} />
      {/* The tick only exists on a confirmed row. A pending mark has no second
          path at all, so there is nothing that could be mistaken for completion. */}
      {confirmed && <path data-verify-tick d="M8 7.5 L11.5 11 L19 3.5" />}
    </svg>
  )
}

export async function RoleEntryList({ roles }: { roles: ComposedRole[] }) {
  const locale = await getLocale()
  const t = await getTranslations("positions")

  return (
    <div className="relative max-w-4xl">
      {/*
        THE READING RAIL, a 1px rule beside the list whose filled portion tracks
        how far through it you have read.

        It is `aria-hidden` and `pointer-events: none` because it duplicates, in a
        graphic, something a screen reader already gets better from the list
        itself: this is the 4th of 7 items. The information is real, which is what
        distinguishes it from decoration, but it is not NEW information.

        `relative` on the wrapper above is what the rail positions against. The
        fill is driven by components/motion/fm/ledger-rail.tsx, it moved there
        from components/motion/sections.ts when it gained a spring and a
        velocity-reactive head. With no JavaScript the rail renders as an empty
        hairline, which is why the reduced-motion block in styles/globals.css
        fills it rather than leaving it at scaleY(0).

        Desktop only: below lg the rail's -1.75rem offset would sit outside the
        gutter, and a one-column list on a phone does not need a progress
        indicator to be readable. `LedgerRail` checks the same breakpoint in JS so
        it does not subscribe to scroll on a viewport where nothing paints.
      */}
      {/* `.thread-steps` indents each row slightly further than the last, capped at
          three steps. Desktop only, see styles/globals.css.

          THE <ul> IS RENDERED BY `LedgerRail`, not here, and the rows are passed
          to it as children. It needs a ref on the LIST because reading progress
          is measured against the rows, the rail itself is absolutely positioned
          and its rect says nothing about how far through the list the reader is.
          See the note at the `useScroll` call in that file. */}
      <LedgerRail>
        {roles.map((r) => (
          <li key={r.key} data-anime="rail-item">
            {/* Effects 20 and 37: the card ground lifts --card → --surface-raised
                and its border warms toward gold on hover. Both ends of both
                transitions are values with computed ratios in :root, so the copy
                inside stays AA through the whole interpolation, there is no
                intermediate ground to check. Both rules include :focus-within so
                a keyboard user reaching the "visit site" link below gets the same
                feedback a pointer user gets; a hover-only lift is a state that
                does not exist for keyboard navigation. */}
            {/*
              #19, A ROW WHOSE REGISTER ENTRY IS UNCONFIRMED HOLDS BACK, then
              resolves to full as it is scrolled past.

              THE FLOOR IS 0.72 AND IT IS A LIMIT, NOT A TASTE CALL.
              --muted-foreground is 5.00:1 on the worst ground in this palette;
              at 0.72 that composites to roughly 3.6:1, which still clears AA for
              the large text in the row and 1.4.11 for the rest. Any lower and a
              pending row becomes genuinely harder to read than a confirmed one,
              at which point verification state is being carried by legibility
              rather than by the words that state it, and the note below insists
              that state is "stated rather than implied", in prose, in both
              locales. The dimming is a nuance on top of the sentence, never a
              substitute for it.
            */}
            <article className="panel-wipe panel-3d card-lift border-travel edge-warm p-6 sm:p-7">
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
                {/*
                  THE VERIFICATION MARK, AND IT IS CONFIRMED-ONLY.

                  This used to render in BOTH states, printing "Register entry
                  pending confirmation" on any row nobody had checked. That was the
                  cautious reading and it was defensible, but it put a standing
                  caveat on the one role this profile leads with, and the site owner
                  removed it ahead of launch.

                  WHAT IS NOT ALLOWED IS THE OTHER FIX. The mark still renders only
                  when `registerConfirmed` is true, so an unchecked row shows NOTHING
                  rather than a confirmation. Silence is not a claim; a tick on an
                  unverified entry would be, and that is the fabrication
                  lib/verification.ts exists to prevent. Do not make the mark
                  unconditional, and do not set registerConfirmed:true in the data
                  to "tidy up" a missing mark — that field means someone checked a
                  public register, nothing else.

                  It sits FIRST in the meta row, before the city and the dates,
                  because it qualifies everything after it.

                  scripts/check-publish-gate.mjs still reports every publishable row
                  without a confirmed register entry, so the outstanding work stays
                  visible to whoever is producing the site even though the visitor
                  no longer sees it.
                */}
                {r.registerConfirmed && (
                  <span className="inline-flex items-center gap-2">
                    <VerifyMark confirmed label={t("registerConfirmed")} />
                    <span className="text-[color:var(--primary-strong)]">{t("registerConfirmed")}</span>
                  </span>
                )}

                {localize(r.city, locale) && <span>{localize(r.city, locale)}</span>}

                {/*
                  THE DATE STATE IS NEVER GUESSED, AND NEVER SILENT.

                  Intake section 4 records the IBC start date as "يُزوَّد لاحقًا"
                  and the membership period likewise. An entry with neither would
                  otherwise render no date at all, which a reader takes as "undated"
                  rather than "pending", so the absence is stated in words.

                  A start year is preferred to a period when both exist: it is the
                  more precise of the two.
                */}
                {/* Effect 10: dates go cool. A date is a position marker, which
                    the --accent-cool split assigns to the structural half of the
                    palette rather than to gold. 6.02:1 on --card, AA at this
                    size.

                    A THIRD BRANCH USED TO PRINT "Start year to be confirmed" in
                    --warning when neither a year nor a period existed. It was
                    removed with the pending register mark above and for the same
                    reason: the row now says nothing about a date it does not have,
                    rather than advertising the gap. Intake section 4 still records
                    the IBC start date as يُزوَّد لاحقًا, and
                    scripts/check-publish-gate.mjs still reports it, so the missing
                    answer stays visible to whoever is producing the site. */}
                {r.startYear ? (
                  <span className="role-date-cool">
                    {t("since")} {r.startYear}
                    {r.endYear ? ` – ${r.endYear}` : ""}
                  </span>
                ) : r.period ? (
                  <span className="role-date-cool">{r.period}</span>
                ) : null}

                {r.organisationUrl && (
                  <a
                    href={r.organisationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    /* Effect 3: an outbound link is the canonical "this goes
                       somewhere", so it takes the cool underline rather than the
                       gold hover. .link-cool supplies its own underline and
                       offset, so the utility classes here are dropped rather
                       than layered, two sources for one decoration is how an
                       underline ends up with two colours. */
                    className="link-cool"
                  >
                    {t("visitSite")}
                  </a>
                )}
              </div>
            </article>
          </li>
        ))}
      </LedgerRail>
    </div>
  )
}
