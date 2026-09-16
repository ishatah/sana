import { getLocale } from "next-intl/server"
import { SectionFigure } from "@/components/section-figure"
import { ProfileImage } from "@/components/profile-image"
import { AboutRings } from "@/components/motion/objects"
import { localize, isEmpty, type LocalizedString } from "@/lib/localize"
import type { ResolvedMedia } from "@/lib/media"

/**
 * The About block: the short bio, a fact list, and the portrait.
 *
 * ── THE LANGUAGES TABLE USED TO LIVE HERE AND IS NOT COMING BACK TO THIS FILE ──
 *
 * It was removed from display at the client's request, and the rows stayed in
 * data/expertise.json throughout. It renders again now, but in two other places:
 * the full table with levels on /expertise (components/languages-table.tsx), and a
 * NAMES-ONLY row in the fact list this component receives via `facts`.
 *
 * It does not return to this file because the column it occupied is the portrait's
 * now, and that figure is load-bearing for the two-column grid, see the note further
 * down. A table reinstated here would either fight the portrait for the column or
 * collapse the layout back to a single block.
 *
 * WHY THE FACT-LIST ROW CARRIES NO LEVELS. Intake section 8 is one of only two
 * fields on the whole form marked MUST CONFIRM, "Never assume a language level from
 * the material supplied", and no level was ever supplied. Levels are nonetheless
 * shown on /expertise, by inference and at the client's explicit instruction, under
 * a caption stating they are not her answer (open question Q9 tracks getting the real
 * ones). This ledger is a two-column label/value list with nowhere to put that
 * caption, so it lists the names alone, which asserts only what intake does record.
 * The caveat and the claim needing it stay together on the other page.
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
  /** The `portrait` slot, already gated by lib/media.ts. Null today, open question Q5. */
  portrait?: ResolvedMedia | null
  /**
   * Her philosophy paragraph, set BENEATH the portrait rather than in its own band.
   *
   * It is first-person and attributable (see data/biography.json), and the whole
   * point of pairing it with the photograph is that a reader should hear it as
   * her saying it, a statement of principle floating in a separate full-bleed
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
   * ── THE GRID MOVED TO CSS, AND THE ALIGNMENT WENT BACK TO CENTRE ─────────────
   *
   * This was `grid items-start gap-14 lg:grid-cols-[1.35fr_1fr] lg:gap-20`, and
   * `items-start` was the right call FOR THE LAYOUT AS IT THEN STOOD: an uncropped
   * portrait with a quote under it ran far taller than the bio and fact list, and
   * centring two columns of very different heights left a dead band above the bio.
   *
   * The heights are no longer very different. `.about-figure-capped` gives the
   * figure a viewport-relative ceiling (see styles/globals.css), so the two columns
   * now finish within a reasonable distance of each other and `align-items: center`
   *, set on the class at `lg` only, is what makes the pair read as one composed
   * block rather than two columns that happen to share a row. Below `lg` the grid
   * is a single column and the alignment is moot.
   *
   * It is a CLASS rather than utilities because the cap, the column ratio and the
   * alignment are one decision: the text column widens BECAUSE the figure narrowed,
   * and splitting that across a utility string here and a rule there is how the two
   * halves drift apart. They are stated together, with the reasoning, in one place.
   */
  return (
    <div className="about-grid">
      {/*
        NO `Reveal` WRAPPER ON EITHER COLUMN: the section's anime.js recipe owns
        both entrances now.

        `Reveal` holds its child at `opacity: 0` until an IntersectionObserver at a
        12% threshold adds `.is-visible`. Inside a full-viewport `MotionScope` that
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
            below, which is what the languages table used to occupy, a figure at a
            fixed ratio holds the two-column grid up whether or not a photograph has
            been supplied, where a float collapsed the layout to a single block the
            moment the slot resolved to null (which is every locale today). */}
        {/* `.about-bio` replaces `text-base leading-[1.9]`: 17px at 1.75 rather
            than 16px at 1.9. Bigger type, and shorter overall, the leading is
            where a paragraph's height actually comes from, so the step up in size
            is paid for by the step down in leading. `.measure` stays: it is the
            only thing standing between this and a 200-character line. */}
        <p data-anime="bio" className="measure about-bio">
          {localize(bio, locale)}
        </p>

        {/*
          ── THE FACT LIST IS NOW A RULED LEDGER ──────────────────────────────────

          It was five loose cells in a `gap-y-5` grid, each with a hover-drawn rule
          UNDER it. Two problems, both structural rather than cosmetic:

            - Five items in two columns leaves a hanging odd cell, and with nothing
              but whitespace between them the block read as a form, five unrelated
              captions, rather than as a spec table annotating the paragraph above.
            - It was the tallest thing in the column after the paragraph, which is
              the other half of why this section ran past a screen.

          `.about-ledger` closes the vertical gaps and gives every cell a hairline
          on its TOP edge, so the rows line up across both columns and the list
          reads as one table. The hanging fifth cell is now a feature of a table
          rather than a gap in a grid.

          THE RULE MOVED FROM UNDER THE CELL TO ON ITS EDGE, and that is why
          `data-interact="rule-item"` / `rule-line` and the `<span className="hover-rule">`
          are gone from this block. That pair is components/motion/interactions.ts'
          `hoverRule`, which animates a real element's width on pointerenter. The
          section still passes `interaction="hoverRule"` at both call sites and that
          is harmless: the interaction queries for `[data-interact="rule-item"]`,
          finds none here, and registers nothing.

          THE GOLD EDGE THAT ONCE DREW ON HOVER IS GONE, a gradient hairline over
          the row's top border, drawn by a CSS transition plus an `.is-lit` class
          from the entrance. `tabIndex={0}` went with it: it existed so a static
          <div> could take `:focus-visible` and draw that edge, and with nothing
          left to draw it only adds an empty stop to the tab order.
        */}
        {facts.length > 0 && (
          <dl className="about-ledger">
            {facts.map((f) => (
              <div key={f.label} data-anime="row" className="about-ledger-row">
                <dt className="about-ledger-label">{f.label}</dt>
                {/*
                  THE SWEEP RIDES THE VALUE, NOT THE LABEL. The value is the piece
                  a reader is actually looking for, "Netherlands", "10+ years",
                  and the label is a small uppercase gold run already. Putting a
                  gold wash through gold type would be invisible; putting it through
                  the value is the effect landing on the word that carries meaning.

                  `.text-sweep` needs no text splitting, which matters here beyond
                  taste: these values include `identity.nationality` and
                  `identity.residence`, and the no-split rule this codebase holds
                  (see components/section-header.tsx) exists precisely so supplied
                  proper nouns stay single intact text nodes.
                */}
                <dd className="about-ledger-value text-sweep">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/*
          ── HER WORDS, NOW BESIDE THE PORTRAIT RATHER THAN BENEATH IT ────────────

          This blockquote used to close the FIGURE column, and the argument for
          putting it there still holds in full: it is first-person and attributable
          (see data/biography.json), and pairing it with the photograph is what
          makes a reader hear it as her saying it rather than as a statement of
          principle floating free.

          IT IS STILL PAIRED WITH THE PHOTOGRAPH. `.about-grid` centres the two
          columns at `lg`, so the quote sits directly across from the portrait on
          the same optical line, which is the pairing the original note was after.
          What has changed is which column carries the height.

          WHY IT HAD TO MOVE. Measured at 1497x900 after the figure was capped: the
          text column came to 471px and the figure column to 793px, 544 of image,
          217 of quote, 32 of gap. The quote was the single largest thing making the
          two columns disagree, and with the portrait no longer free to run long it
          became the thing setting the section's height. Moved across, it fills the
          text column's shortfall instead of adding to the taller one's surplus, so
          the two columns land close to level and the section fits a laptop screen.

          Everything else about it is untouched: `availability.quote` still decides
          whether it renders at all, the `<cite>` stays inside a `<footer>` so the
          attribution is bound to the statement in the accessibility tree, and no
          decorative quotation mark is drawn, the glyph is in neither locale's data
          and a one-sided mark reads as a stray character in Arabic.
        */}
        {/* `.block-rule`, not `border-t`. A rule spanning the column would close
            the paragraph above and open a separate region; this quote is by the
            same subject as the prose it follows, so the mark opens a passage
            instead of ending one. See styles/globals.css. */}
        {/* `mt-14`, not the `mt-8` this carried in the figure column, and the gap
            is doing MORE work than it used to. The ledger above ends in a
            full-width rule, and `.block-rule` is now full width too rather than a
            third of the way across, so the two marks are the same length and the
            spacing is the only thing left telling them apart. At a short gap they
            would read as one more ledger row that lost its label; `mt-14` is what
            separates the closing of the table from the opening of the quote. */}
        {quoteText && (
          <blockquote data-anime="row" className="block-rule mt-14 pt-6">
            {/* `.about-quote` replaces `text-base sm:text-lg`. One fluid step that
                starts at the bio's size rather than below it, this is her own
                first-person statement and it was previously set SMALLER than the
                third-person paragraph beside it on every screen under 640px. */}
            <p className="about-quote">{quoteText}</p>
            {quoteAttribution && (
              <footer className="eyebrow mt-4 text-[color:var(--primary-strong)]">
                <cite className="not-italic">{quoteAttribution}</cite>
              </footer>
            )}
          </blockquote>
        )}
      </div>

      {/* The portrait column. Where the languages table used to be, and load-bearing
          for the grid: SectionFigure renders a ruled frame holding the drifting
          rings while the slot is empty, so the two-column layout is correct today
          and the photograph drops into the same box when one is approved. */}
      {/* `.about-figure` lifts the portrait out of the grid's top edge on desktop
          so it overlaps the band above, which is what stops the two-column split
          reading as two equal boxes. Single-column below lg, where the lift is
          suppressed, see styles/globals.css. */}
      {/* `.about-figure-capped` is the new half: a `max-height` on the <img> at
          `lg` and up, so the portrait is scaled to fit a share of the viewport
          rather than setting the section's height by itself. Nothing is cropped,
          see the rule in styles/globals.css for why a cap and a crop are different
          things here. */}
      <div data-anime="figure" className="about-figure about-figure-capped">
        {portrait ? (
          /*
            THE PHOTOGRAPH IS NO LONGER CROPPED, AND THAT IS THE WHOLE CHANGE HERE.

            This was a `SectionFigure` at a fixed `4 / 5` frame with the image set
            to `object-cover`. The supplied portrait is 1206x1748, roughly 2:3,
            so covering a 4:5 box cut a band off the TOP and the BOTTOM of her:
            the frame took the crop it needed and the subject was what got
            trimmed. No focal point tuning fixes that, because the problem is not
            where the crop sits, it is that a crop is happening at all.

            `object-contain` inside that frame would have been the wrong fix too,
            it keeps the whole image but letterboxes it inside a bordered box,
            which reintroduces the visible frame edge the hero deliberately got
            rid of.

            So the frame goes and the image sets its own height (`h-auto w-full`).
            Nothing is cropped in either direction.

            THERE IS NO FADE IN THIS FILE, AND THAT IS ON PURPOSE. The bottom fade
            is baked into the asset's alpha channel by
            scripts/build-portrait-cutout.mjs.

            A CSS mask was tried here first and could not work. The supplied
            photograph has a studio floor across its lower portion, which the
            cutout's luminance pass correctly keeps, the floor is dark, not white,
            so it is indistinguishable from her abaya by colour. That left a
            full-width opaque BAND at the bottom of the file, and a mask only
            reduces a region's opacity: the band stays a rectangle, so its straight
            upper edge reads exactly as hard as before. The rectangle had to stop
            existing, which can only happen in the alpha channel.

            Fading in the asset is also simply better here: the ramp is measured
            against the photograph's own geometry rather than against whatever box
            the layout gives it, so it cannot drift out of alignment when the
            column is resized, and it needs no `mask-repeat`/`mask-size` companions
            to behave (a lesson learned, a gradient mask ending before 100% tiles
            by default and repaints the very edge it was hiding).
          */
          <ProfileImage
            media={portrait}
            priority
            sizes="(max-width: 1024px) 100vw, 32rem"
            className="h-auto w-full select-none"
          />
        ) : (
          /* Slot empty, the ruled frame holds the column's shape, exactly as before.
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

      </div>
    </div>
  )
}
