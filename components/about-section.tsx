import { getLocale } from "next-intl/server"
import { SectionFigure } from "@/components/section-figure"
import { ProfileImage } from "@/components/profile-image"
import { AboutRings } from "@/components/motion/objects"
import { localize, isEmpty, type LocalizedString } from "@/lib/localize"
import type { ResolvedMedia } from "@/lib/media"

/**
 * The About block: the short bio, a fact list, and the portrait.
 *
 * THE LANGUAGES TABLE USED TO LIVE HERE AND HAS BEEN REMOVED FROM DISPLAY ONLY.
 * Intake section 8 is one of only two fields on the whole form marked MUST
 * CONFIRM — "Never assume a language level from the material supplied" — and only
 * Turkish is confirmed; Arabic and English are still `status: "to-confirm"`.
 *
 * None of that has been resolved, so none of it has been deleted: the rows remain
 * in data/expertise.json, the editor remains at /admin/expertise, and open
 * question q1 in data/deliverables.json still tracks the missing levels. What is
 * gone is the rendering, at the client's request. The distinction matters,
 * because the original component carried an explicit warning that omitting these
 * languages "would silently drop two of her three languages" — that warning is
 * about inventing or hiding a CREDENTIAL, and it is honoured by the data and the
 * open question surviving intact. Restoring the section is one commit; recovering
 * discarded intake data is not.
 *
 * The same restraint still governs the fact list: `careerStartYear` is empty on
 * the form and so the row is not rendered at all, rather than showing a derived
 * "since 2016" from the "10 or more years" answer.
 */
export async function AboutSection({
  bio,
  facts,
  portrait = null,
  quote,
  quoteAttribution,
}: {
  bio: LocalizedString
  facts: { label: string; value: string }[]
  /** The `portrait` slot, already gated by lib/media.ts. Null today — open question Q5. */
  portrait?: ResolvedMedia | null
  /**
   * Her philosophy paragraph, set BENEATH the portrait rather than in its own band.
   *
   * It is first-person and attributable (see data/biography.json), and the whole
   * point of pairing it with the photograph is that a reader should hear it as
   * her saying it — a statement of principle floating in a separate full-bleed
   * band a screen further down belongs to nobody in particular.
   *
   * Optional, and guarded the same way `Quote` guards itself: empty text renders
   * nothing at all rather than an attribution line under a blank. An attribution
   * with no statement above it reads as a quote she never gave, which is exactly
   * the failure this build is organised against.
   */
  quote?: LocalizedString
  quoteAttribution?: string
}) {
  const locale = await getLocale()
  const quoteText = quote && !isEmpty(quote) ? localize(quote, locale) : ""

  /*
   * `items-start` on the grid below, NOT `items-center`. Centring was right while
   * the figure was a fixed 4:5 box of roughly the text column's height. An
   * uncropped portrait with a quote under it is substantially taller than the bio
   * and fact list, and centring two columns of very different heights pushes the
   * shorter one into the middle — leaving a large empty band above the bio and
   * starting the two columns on different optical lines. Top-aligned, the bio and
   * the portrait begin together and the column simply runs longer.
   */
  return (
    <div className="grid items-start gap-14 lg:grid-cols-[1.35fr_1fr] lg:gap-20">
      {/*
        NO `Reveal` WRAPPER ON EITHER COLUMN — the section's anime.js recipe owns
        both entrances now.

        `Reveal` holds its child at `opacity: 0` until an IntersectionObserver at a
        12% threshold adds `.is-visible`. Inside a full-viewport `AnimeScope` that
        is a SECOND gate on the same element, and it is the one that fails:
        measured on /en, these wrappers sat at `opacity: 0` / `translateY(24px)`
        while the `data-anime` targets inside them had already animated to
        `opacity: 1`. The wrapper was hiding content the recipe had revealed.

        `aboutSpread` animates `[data-anime="bio"]`, `[data-anime="figure"]` and
        each `[data-anime="row"]` directly, and every one of them is protected by
        `ensureVisible`. The CSS `prefers-reduced-motion` block forces `[data-anime]`
        visible, so the no-motion floor is intact without this wrapper.
      */}
      <div>
        {/* The portrait no longer floats inside this column. It has its own column
            below, which is what the languages table used to occupy — a figure at a
            fixed ratio holds the two-column grid up whether or not a photograph has
            been supplied, where a float collapsed the layout to a single block the
            moment the slot resolved to null (which is every locale today). */}
        <p data-anime="bio" className="measure text-base leading-[1.9] text-[color:var(--foreground)]">
          {localize(bio, locale)}
        </p>

        {facts.length > 0 && (
          <dl className="mt-10 grid gap-x-8 gap-y-5 sm:clear-both sm:grid-cols-2">
            {facts.map((f) => (
              <div
                key={f.label}
                data-anime="row"
                data-interact="rule-item"
                // Focusable so the rule is reachable by keyboard; the interaction
                // binds focusin as well as pointerenter.
                tabIndex={0}
                className="outline-offset-4"
              >
                <dt className="mb-1 font-display text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--primary-strong)]">
                  {f.label}
                </dt>
                <dd className="text-sm leading-relaxed text-[color:var(--card-foreground)]">{f.value}</dd>
                {/* Drawn on hover/focus. Decorative — the label and value above are
                    always fully visible. */}
                <span aria-hidden className="hover-rule mt-2" data-interact="rule-line" />
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* The portrait column. Where the languages table used to be, and load-bearing
          for the grid: SectionFigure renders a ruled frame holding the drifting
          rings while the slot is empty, so the two-column layout is correct today
          and the photograph drops into the same box when one is approved. */}
      {/* `.about-figure` lifts the portrait out of the grid's top edge on desktop
          so it overlaps the band above, which is what stops the two-column split
          reading as two equal boxes. Single-column below lg, where the lift is
          suppressed — see styles/globals.css. */}
      <div data-anime="figure" className="about-figure">
        {portrait ? (
          /*
            THE PHOTOGRAPH IS NO LONGER CROPPED, AND THAT IS THE WHOLE CHANGE HERE.

            This was a `SectionFigure` at a fixed `4 / 5` frame with the image set
            to `object-cover`. The supplied portrait is 1206x1748 — roughly 2:3 —
            so covering a 4:5 box cut a band off the TOP and the BOTTOM of her:
            the frame took the crop it needed and the subject was what got
            trimmed. No focal point tuning fixes that, because the problem is not
            where the crop sits, it is that a crop is happening at all.

            `object-contain` inside that frame would have been the wrong fix too —
            it keeps the whole image but letterboxes it inside a bordered box,
            which reintroduces the visible frame edge the hero deliberately got
            rid of.

            So the frame goes and the image sets its own height (`h-auto w-full`).
            Nothing is cropped in either direction.

            The soft edge is a MASK, not a gradient overlay, for the same reason as
            the hero (see components/hero.tsx): an overlay would have to paint the
            page's exact backdrop on top of the image to hide its edge, and any
            painted colour is wrong the moment the ground behind it is not a flat
            value. A mask removes the pixels, so whatever is behind shows through
            by construction — and it keeps working if the section's ground ever
            changes.

            Bottom only, as asked. The cutout PNG already carries transparency on
            its other three sides (scripts/build-portrait-cutout.mjs), so the only
            edge that needs softening is the one where the photograph itself ends.
          */
          <ProfileImage
            media={portrait}
            priority
            sizes="(max-width: 1024px) 100vw, 32rem"
            className="portrait-fade-b h-auto w-full select-none"
          />
        ) : (
          /* Slot empty — the ruled frame holds the column's shape, exactly as before.
             A placeholder IS a box, so it keeps the fixed ratio a photograph no
             longer needs. */
          <SectionFigure
            media={null}
            ratio="4 / 5"
            width={432}
            height={540}
            sizes="(max-width: 1024px) 100vw, 32rem"
          >
            <AboutRings />
          </SectionFigure>
        )}

        {/*
          HER WORDS, UNDER HER PHOTOGRAPH.

          Set as a `<blockquote>` with a `<cite>` in its footer so the attribution
          is bound to the statement in the accessibility tree, not merely printed
          near it — the same reason ProfileImage renders a credit as a <figure>.

          No quotation marks are drawn as decoration: the mark is typed into
          neither locale's data, and a decorative glyph on one side only reads as a
          stray character in Arabic, where the block runs right to left.
        */}
        {quoteText && (
          <blockquote data-anime="row" className="mt-8 border-t border-[color:var(--border)] pt-6">
            <p className="font-display text-base leading-relaxed text-[color:var(--heading)] sm:text-lg">
              {quoteText}
            </p>
            {quoteAttribution && (
              <footer className="eyebrow mt-4 text-[color:var(--primary-strong)]">
                <cite className="not-italic">{quoteAttribution}</cite>
              </footer>
            )}
          </blockquote>
        )}
      </div>
    </div>
  )
}
