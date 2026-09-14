/**
 * The hero stat bar — three figures in a ruled row.
 *
 * EVERY NUMBER IS COUNTED, NOT CLAIMED. This is the component most likely to
 * drift into fabrication, because the reference design it copies reads
 * "5+ Experiences / 20+ Project done / 80+ Happy Clients" — three figures that
 * sound like achievements and are, in a template, entirely arbitrary.
 *
 * `data/biography.json` already refuses to play that game: its `stats[]` block
 * has `members`, `events`, `companies` and `countries` all set to `null`, with a
 * comment recording that intake section 12 returned "Nothing supplied". Those
 * remain null and unrendered.
 *
 * So the figures here are derived from records that exist and can be checked:
 * the count of published positions, the count of published recognitions, and the
 * years-of-experience string the About section already displays. Each is filtered
 * through `publishable()` (lib/verification.ts) rather than `.length`, so a row
 * marked tier C or `publish: false` can never silently inflate a number the
 * visitor reads as verified.
 *
 * A ZERO IS NEVER SHOWN. lib/profile-content.ts argues the point directly — "an
 * empty stat counter reading 0 is worse than no counter" — so a cell with nothing
 * to count is dropped, and the bar disappears entirely if none survive.
 */

export interface Stat {
  /** The figure. Already a string, because "10+" is not a number. */
  value: string
  label: string
  /**
   * `count` marks a cell whose value is a TALLY of records — published positions,
   * published memberships. Anything else (a duration, a market list) is left
   * undefined and is never suppressed for being small.
   *
   * The distinction has to be declared rather than sniffed from the string: "10+"
   * and "1" are both numeric-looking, and a rule that suppressed low numbers by
   * inspecting the text would eventually hide a legitimate "1 year" or, worse,
   * read "10+" as starting with a 1.
   */
  kind?: "count"
}

export function StatBar({ stats, className = "" }: { stats: Stat[]; className?: string }) {
  /*
   * TWO SUPPRESSION RULES, AND THE SECOND IS THE SAME ARGUMENT AS THE FIRST.
   *
   * The original rule was "a zero is never shown", on the grounds that an empty
   * counter reading 0 is worse than no counter. A count of ONE fails for exactly
   * the same reason: "Positions held: 1" is truthfully computed and still reads as
   * thinness rather than authority, because a stat bar is a format that promises a
   * tally worth tallying. One record is a fact better carried by the Positions
   * section, which names it in full.
   *
   * It is self-restoring: nothing here is hardcoded to this client's data, so the
   * cell returns on its own the moment a second position publishes. That is the
   * same property the zero rule has, and the reason neither needs revisiting.
   *
   * Only `kind: "count"` cells are affected. "10+ years" is not a tally and is
   * never suppressed.
   */
  const shown = stats.filter((s) => {
    if (!s.value || s.value === "0") return false
    if (s.kind === "count" && Number(s.value) < 2) return false
    return true
  })
  if (shown.length === 0) return null

  return (
    <dl
      className={`inline-flex flex-wrap border border-[color:var(--border)] ${className}`}
    >
      {shown.map((s, i) => (
        <div
          key={s.label}
          /*
           * `border-s` on every cell except the first draws the dividers with no
           * separate elements — and `-s` rather than `-l` means the rules fall on
           * the correct side in Arabic without a second rule set, the same
           * logical-direction approach the timeline rail uses.
           */
          className={`px-6 py-5 sm:px-8 ${i > 0 ? "border-s border-[color:var(--border)]" : ""}`}
        >
          <dt className="sr-only">{s.label}</dt>
          <dd>
            <span className="block font-display text-2xl leading-none text-[color:var(--primary)] sm:text-3xl">
              {s.value}
            </span>
            <span className="mt-2 block text-xs text-[color:var(--muted-foreground)]">{s.label}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
