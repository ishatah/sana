import { getLocale, getTranslations } from "next-intl/server"
import { localize, type LocalizedString } from "@/lib/localize"

/**
 * The working languages, one row per language.
 *
 * ── THIS SECTION WAS REMOVED FROM DISPLAY ONCE, AND WHY IT IS BACK ──────────────
 *
 * The rows lived in data/expertise.json for several builds with nothing rendering
 * them, because intake section 8 is one of only two MUST CONFIRM fields on the whole
 * form, "Never assume a language level from the material supplied", and no level was
 * ever supplied. Names with no levels was judged not worth a section.
 *
 * It renders again because the languages were asked for. The levels it shows are
 * INFERRED by the implementation rather than supplied by her, which is a real
 * exception to the rule above and is recorded as such in three places: the
 * `_comment_levels` block in data/expertise.json, open question Q9, and
 * docs/content-gaps.md.
 *
 * ── SO THE ONE THING THIS COMPONENT MUST NOT DO IS LAUNDER THAT ─────────────────
 *
 * A level printed in a clean table reads as her own answer. Every inferred row is
 * therefore marked, and the caption below the table says plainly that the levels are
 * not confirmed by her. That caption is not decoration and not a hedge: it is the
 * difference between disclosing an inference and passing one off.
 *
 * The marking is driven by `status`, so NOTHING HERE CHANGES when the levels are
 * confirmed. Set `status: "confirmed"` on a row in the data and its footnote marker
 * disappears; confirm all of them and the caption goes too, because it only renders
 * when at least one inferred row is present. That is the intended end state (Q9) and
 * the reason this is keyed off data rather than a flag in the code.
 */

/** The status values the data can carry, and how each one renders. */
type LangStatus = "confirmed" | "inferred" | "to-confirm"

/**
 * Anything unrecognised is treated as `to-confirm`, and the direction of that default
 * is the point.
 *
 * There is no schema behind this field, app/api/admin/content/[section]/route.ts does
 * structural checks only and writes unknown values through untouched, so a typo like
 * "infered" reaches this component intact. Falling back to `to-confirm` means a
 * mistyped status renders as PENDING, never as confirmed: the failure mode is a level
 * withheld, not a level asserted on her behalf.
 */
function readStatus(raw: unknown): LangStatus {
  return raw === "confirmed" || raw === "inferred" ? raw : "to-confirm"
}

export type LanguageRow = {
  code?: string
  name?: LocalizedString
  speaking?: string
  writing?: string
  business?: boolean | null
  status?: string
}

export async function LanguagesTable({ items }: { items: LanguageRow[] }) {
  const locale = await getLocale()
  const t = await getTranslations("expertise")
  // The site-wide pending wording, used when a row has no level recorded. Resolved
  // here rather than inside the map: `await` cannot appear inside the JSX below.
  const tDraft = await getTranslations("draft")

  // A level is only ever printed through the message catalogue. The raw values are
  // the enum strings "native"/"fluent"/"professional"/"basic", which are English
  // regardless of the page's locale, so rendering one directly would leak an
  // untranslated word onto /ar and /nl.
  const levelLabel = (raw: string | undefined) => {
    if (raw === "native" || raw === "fluent" || raw === "professional" || raw === "basic") {
      return t(`level.${raw}`)
    }
    // No level recorded. The row still renders, the name is the fact worth having;
    // only the level cell falls back to the site-wide pending wording.
    return null
  }

  const rows = items
    .map((l) => ({ ...l, resolvedStatus: readStatus(l.status) }))
    // A row with no name in any locale has nothing to say. Same filter as the
    // organisations list in lib/seo.ts, and for the same reason.
    .filter((l) => localize(l.name, locale) !== "")

  if (rows.length === 0) return null

  const anyInferred = rows.some((l) => l.resolvedStatus === "inferred")

  return (
    <>
      {/* `.about-ledger` rather than a fresh grid: this is the same object as the
          About fact list, a ruled table of label/value pairs annotating the prose
          above it, and the two should not drift into looking different. The rule
          sits on each row's TOP edge so the set reads as one table. */}
      <dl className="about-ledger mx-auto max-w-3xl">
        {rows.map((l) => {
          const speaking = levelLabel(l.speaking)
          const writing = levelLabel(l.writing)
          const inferred = l.resolvedStatus === "inferred"

          return (
            <div key={l.code ?? localize(l.name, locale)} data-anime="row" className="about-ledger-row">
              <dt className="about-ledger-label">
                {localize(l.name, locale)}
                {/* The footnote marker ties this row to the caption below. It is
                    aria-hidden because a lone asterisk announced mid-phrase is
                    noise; the caption carries the same information as text, and a
                    screen reader reaching it gets the statement in full. */}
                {inferred && (
                  <span aria-hidden className="ms-1 align-super text-[0.6em] text-[color:var(--warning)]">
                    *
                  </span>
                )}
              </dt>
              <dd className="about-ledger-value">
                {speaking || writing ? (
                  <span className="text-sweep">
                    {/* Speaking and writing are labelled rather than positional: they
                        are the same word in most rows, and two bare identical values
                        side by side tell a reader nothing about which is which. */}
                    {speaking && `${t("speakingLabel")} ${speaking}`}
                    {speaking && writing && " · "}
                    {writing && `${t("writingLabel")} ${writing}`}
                  </span>
                ) : (
                  /* No level recorded for this row. Says so, rather than rendering an
                     empty cell that reads as an omission. */
                  <span className="italic text-[color:var(--muted-foreground)]">
                    {tDraft("pendingField")}
                  </span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>

      {anyInferred && (
        /* ONE CAPTION, NOT A REPEATED BADGE PER ROW. All four rows are inferred
           today, so a per-row tag would print the same sentence four times and read
           as boilerplate, which is how a disclaimer stops being read. Stated once,
           under the table, where it applies to the marked rows. */
        <p className="mx-auto mt-5 max-w-3xl text-[0.75rem] leading-relaxed text-[color:var(--muted-foreground)]">
          <span aria-hidden className="me-1 text-[color:var(--warning)]">
            *
          </span>
          {t("levelInferred")}
        </p>
      )}
    </>
  )
}
