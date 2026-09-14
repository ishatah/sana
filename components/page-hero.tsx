import { Reveal } from "@/components/motion/reveal"
import { AnimeScope } from "@/components/motion/anime-scope"

/**
 * The opening band of a dedicated page.
 *
 * Deliberately NOT the home `Hero`. That one is a near-full-height band carrying
 * the name at display size, which is right for a landing page and wrong for a
 * document you arrived at on purpose — it would put a screen of masthead between
 * the visitor and the thing they clicked to read. This is compact: eyebrow, one
 * `h1`, an optional lede, and the same gold rule the section headings use, so the
 * two read as one system.
 *
 * THE POINTER-TRACKED GOLD WASH IS GONE. This used to render a radial gradient
 * whose centre followed the cursor (`interaction="heroPointer"`). Two reasons it
 * went, matching the home hero, which lost the same gradient:
 *
 *   - A soft radial glow is the default "make the header look designed" backdrop,
 *     and it is the kind of thing that reads as generated precisely because it is
 *     applied without reference to what the page is about.
 *   - Making it chase the cursor is decoration reacting to the pointer rather than
 *     to the reader. On a page of verified titles and dates, that is the wrong
 *     register — and it was invisible to anyone on a touch device or a keyboard
 *     anyway, since the interaction skipped coarse pointers entirely.
 *
 * The band is now flat ground and type, which is what the rest of the site is.
 *
 * LEFT-ALIGNED, not centred — the same correction `SectionHeader` carries. Every
 * page below this opens with a left-aligned heading over left-aligned content, so
 * a centred title at the top shared an edge with nothing beneath it.
 *
 * IT CARRIES THE PAGE'S ONLY `h1`. Each route needs exactly one, and every
 * `SectionHeader` below it renders an `h2`, so the outline stays well-formed.
 *
 * The top padding lives in `.page-hero` rather than here, because it has to be
 * offset by the draft banner's measured height — see the
 * `body[data-draft-banner] .page-hero` rule in styles/globals.css.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string
  title: string
  lede?: string
}) {
  return (
    <AnimeScope as="section" className="page-hero">
      <div className="container-page">
        <Reveal>
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}

          {/* `data-anime="heading"` opts this into the word-reveal. Safe here: the
              title is always a translated UI string, never an organisation name. */}
          <h1 className="page-hero-title mb-5" data-anime="heading">
            {title}
          </h1>

          {/* `.space-border`, the same divider every section heading uses. This was
              an inline SVG whose path anime.js could draw on, but nothing had
              animated it for some time — it rendered as a static, fully-drawn line —
              so the vector bought nothing over a styled div. `.rule-start` pulls it
              to the leading edge now that the band is not centred. */}
          <div className="space-border rule-start" aria-hidden />

          {lede && (
            <p className="mt-6 max-w-2xl text-[color:var(--foreground)]" data-anime="lede">
              {lede}
            </p>
          )}
        </Reveal>
      </div>
    </AnimeScope>
  )
}
