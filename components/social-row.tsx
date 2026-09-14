/**
 * The social rail in the hero.
 *
 * IT RENDERS NOTHING UNTIL THERE IS SOMEWHERE TO GO.
 *
 * `data/siteSettings.json` ships `"social": []` with a comment recording why:
 * intake section 9 returns "لم يُزوَّد" for every account, and a unified handle is
 * to be proposed after the domain is approved. There is no profile URL for this
 * person anywhere in the project.
 *
 * THIS USED TO DRAW FOUR DECORATIVE CIRCLES INSTEAD, and the reasoning was that
 * the reference design has four social icons and the hero "reads as unfinished"
 * without them. The accessibility of that was handled properly — `aria-hidden`,
 * not links, not focusable, no `href="#"` — but it was still a layout decorated to
 * look complete, and two of the four glyphs were Dribbble and Behance: a
 * designer's portfolio set, inherited from the template rather than chosen for a
 * business-development consultant. Nobody picked those platforms for her.
 *
 * Every other empty section in this build hides itself rather than rendering a
 * shell — that is the rule the whole `getSectionAvailability()` layer exists to
 * enforce — and this is now consistent with it. An absent rail says nothing; four
 * grey rings imply accounts that do not exist.
 *
 * NO CAPABILITY IS LOST. The moment a real `{id, label, url}` entry is added to
 * siteSettings.json, that icon becomes a genuine labelled link with no code change
 * here. The icon set below is kept for exactly that, minus the two that were only
 * ever template filler.
 */

export interface SocialLink {
  id: string
  label: string
  url: string
}

/**
 * A TEXT MARK RATHER THAN AN ICON.
 *
 * These were hand-drawn SVG glyphs — one stroke weight, one 24-unit box — because
 * lucide deprecated its brand set. All SVG has now been removed from the app, so
 * the ring carries a letter instead: the platform's initial, set in the display
 * face at the same optical size the glyph occupied.
 *
 * THIS IS A REAL TRADE AND IT IS WORTH STATING. A brand glyph is recognised
 * pre-attentively and a letter is not — "in" reads as LinkedIn instantly, "I" is
 * ambiguous with any number of platforms. What keeps that acceptable here is that
 * every ring is a labelled link: `aria-label` carries the platform name for
 * assistive tech and `title` surfaces it on hover for everyone else, so the letter
 * is a visual anchor rather than the only identification.
 *
 * MARKS ARE PER-PLATFORM rather than a blind `id[0]`, because the recognisable
 * short form is not always the first letter — LinkedIn's is "in", lowercase. An
 * unknown id falls back to its own initial, so a new entry renders something sane
 * rather than an empty ring.
 */
const MARKS: Record<string, string> = {
  instagram: "Ig",
  linkedin: "in",
  x: "X",
  facebook: "f",
  youtube: "Yt",
}

function mark(id: string) {
  return MARKS[id] ?? (id.trim()[0]?.toUpperCase() ?? "•")
}

/** The circle itself. */
const RING =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--muted-foreground)] transition-colors"

export function SocialRow({ links = [], className = "" }: { links?: SocialLink[]; className?: string }) {
  // Anything with an actual destination. An entry with an empty url is treated as
  // absent rather than rendered as a dead link.
  const real = links.filter((l) => l.url?.trim())

  // Nothing to link to: render nothing. See the docblock — an absent rail makes no
  // claim, while a decorative one implies accounts that do not exist.
  if (real.length === 0) return null

  return (
    <ul className={`flex flex-wrap items-center gap-3 ${className}`}>
      {real.map((l) => (
        <li key={l.id}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={l.label}
            title={l.label}
            className={`${RING} hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]`}
          >
            {/* aria-hidden: the letter is decoration layered over the link's own
                `aria-label`. Without this a screen reader announces the mark and
                then the label — "in, LinkedIn" — which is noise. */}
            <span aria-hidden className="font-[family-name:var(--font-display)] text-[0.95rem] leading-none">
              {mark(l.id)}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
