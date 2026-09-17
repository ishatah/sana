import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ProfileImage } from "@/components/profile-image"
import { type Stat } from "@/components/stat-bar"
import { type SocialLink } from "@/components/social-row"
import { RoleCycle } from "@/components/motion/fm/role-cycle"
import { VvipField } from "@/components/motion/fm/vvip-field"
import { VvipStagger, VvipRise, VvipPortraitReveal } from "@/components/motion/fm/vvip-entrance"
import { OrganisationLogo } from "@/components/organisation-logo"
import { localize, type LocalizedString } from "@/lib/localize"
import type { ResolvedMedia } from "@/lib/media"

/**
 * The hero, in the light IBC-blue identity.
 *
 * ── WHAT THIS IS AND WHAT IT REPLACES ─────────────────────────────────────────
 *
 * A light-ground rebuild of components/hero.tsx, which is the dark/gold original
 * and is still in the tree. Both are mounted from app/[locale]/page.tsx; swapping
 * the import swaps the hero. The original is kept rather than deleted because it
 * is 778 lines carrying a great deal of measured reasoning about the dark scheme,
 * and that record should not be destroyed by a theme change that may be reviewed
 * and reversed.
 *
 * ── IT IS A SERVER COMPONENT, AND THAT IS LOAD-BEARING ───────────────────────
 *
 * Every string here comes from the CMS through `localize()`, so the hero renders
 * in all three locales, keeps working in RTL, and stays editable at /admin. The
 * animation is confined to three client leaves (VvipField, VvipStagger/VvipRise,
 * VvipPortraitReveal) which take already-rendered server output as children. The
 * copy is therefore in the HTML source, not injected after hydration, which is
 * what keeps it indexable and readable with JS disabled.
 *
 * ── NO BOX-DRAWING RULES INSIDE JSX COMMENTS IN THIS FILE ────────────────────
 *
 * The section dividers in the markup below are plain one-line comments rather
 * than the box-drawing rule comments this codebase uses elsewhere in markup,
 * and that is a workaround for a real crash rather than a style choice.
 *
 * Next 16.2.6's Rust code-frame highlighter slices source lines by BYTE offset
 * without checking char boundaries. `─` (U+2500) is three bytes, so a long rule
 * inside a JSX comment gives it a line whose byte length is far past its char
 * length, and when it tries to frame that line it panics:
 *
 *     thread '<unnamed>' panicked at crates/next-code-frame/src/highlight.rs
 *     end byte index 121 is not a char boundary; it is inside '─'
 *
 * That took down the dev server on every home-page compile, because this file is
 * what the home route rebuilds. The rules in the DOCBLOCKS above are fine and are
 * left alone — the crash needs a JSX-comment line for the highlighter to frame.
 *
 * It is an upstream bug, not invalid source, so this is worth revisiting when
 * Next is upgraded. Until then, keep JSX comments here short and ASCII.
 *
 * ── THE PROP CONTRACT IS THE ORIGINAL'S, UNCHANGED ───────────────────────────
 *
 * Identical shape to components/hero.tsx so the two are interchangeable at the
 * call site with no edit to page.tsx beyond the import. `social` is accepted and
 * deliberately unused: it is empty by design today (intake section 9 records every
 * account as "لم يُزوَّد"), and the original renders decorative rings for it. A
 * decorative ring that links nowhere is exactly the kind of flourish this design
 * is built without, so it is dropped from the markup while staying in the type,
 * which keeps the swap lossless if it is ever wanted back.
 */
export async function HeroVvip({
  kicker,
  name,
  roles,
  title,
  locations,
  stats = [],
  contactHref,
  aboutHref,
  portrait = null,
  organisationLogo = null,
  statement = null,
}: {
  kicker: LocalizedString
  name: string
  roles: string[]
  /** The full legal title. Rendered verbatim; never abbreviated to fit. */
  title: LocalizedString
  locations: { label: LocalizedString; value: LocalizedString }[]
  /**
   * ACCEPTED AND DELIBERATELY NOT RENDERED, see the docblock above. Empty by
   * design today, and a decorative ring that links nowhere is the kind of
   * flourish this design is built without. Kept in the type so the swap with
   * components/hero.tsx stays lossless in both directions.
   */
  social?: SocialLink[]
  /**
   * The `hero-background` slot. ACCEPTED AND NOT RENDERED: this design's ground
   * is the white page plus VvipField, so a photographic backdrop would fight
   * both. Null today regardless (the supplied files are 1206px against a 1920px
   * requirement), so nothing is being hidden that would otherwise show.
   */
  background?: ResolvedMedia | null
  /** Counted from published records only. See components/stat-bar.tsx. */
  stats?: Stat[]
  contactHref: string
  aboutHref: string
  portrait?: ResolvedMedia | null
  /**
   * The organisation's mark, already gated by lib/media.ts.
   *
   * Null whenever the slot is closed, which it is until a permission record
   * exists, so the affiliation block below simply does not render. That is the
   * whole reason this is a resolved slot rather than a hardcoded path: the rights
   * question is answered in data, not by remembering to comment out some JSX.
   */
  organisationLogo?: ResolvedMedia | null
  /** The signed personal statement. Optional, and all-or-nothing: see below. */
  statement?: { text: LocalizedString; attribution: LocalizedString } | null
}) {
  const locale = await getLocale()
  const t = await getTranslations("hero")

  /*
   * The meta row, assembled exactly as the original assembles it, including the
   * filters. This is a presentation decision (which facts sit in one row) rather
   * than a data one, which is why it lives here and not in the page.
   *
   * The `stats` filters are not cosmetic and are copied deliberately: a stat with
   * an empty value, a literal "0", or a `kind: "count"` tally below 2 is dropped.
   * That last rule is why "Positions held: 1" never appears — one record is a fact
   * better carried by the Roles page, which names it in full. Dropping these
   * filters would resurrect a line the content gate exists to suppress.
   */
  const meta = [
    ...stats
      .filter((stat) => stat.value && stat.value !== "0")
      .filter((stat) => !(stat.kind === "count" && Number(stat.value) < 2))
      .map((stat) => ({ label: stat.label, value: stat.value })),
    ...locations.map((loc) => ({
      label: localize(loc.label, locale),
      value: localize(loc.value, locale),
    })),
  ].filter((entry) => entry.label && entry.value)

  /* Localized once, because both halves are tested before either renders. */
  const statementText = statement ? localize(statement.text, locale).trim() : ""
  const statementAttribution = statement ? localize(statement.attribution, locale).trim() : ""

  const kickerText = localize(kicker, locale)
  const titleText = localize(title, locale)

  return (
    <section className="vvip-hero">
      {/* The animated ground: a slow blue wash and the drifting IBC squares.
          aria-hidden inside the component, and a SIBLING of the content rather
          than a wrapper — nesting the content inside decoration would put the
          whole hero behind aria-hidden. */}
      <VvipField />

      <div className="container-page relative z-10 grid items-center gap-12 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20 lg:py-14">
        {/* The text column. */}
        <VvipStagger className="flex flex-col gap-7">
          {kickerText && (
            <VvipRise>
              <p className="vvip-eyebrow">{kickerText}</p>
            </VvipRise>
          )}

          {/* The <h1> carries the NAME ALONE. The kicker above is the lead-in
              ("I am" / "Ik ben" / "أنا"), and the two were once printed together
              which set the name twice, a line apart. See data/headline.json. */}
          <VvipRise>
            <h1 className="vvip-name">{name}</h1>
          </VvipRise>

          {/* RoleCycle is reused from the dark hero rather than reimplemented: it
              already refuses to rotate a single role, and never arms its interval
              at all under reduced motion. */}
          {roles.length > 0 && (
            <VvipRise>
              <RoleCycle roles={roles} className="vvip-role" />
              {/*
                THE SR-ONLY LIST IS NOT REDUNDANT, IT IS THE ONLY COMPLETE ONE.
                `RoleCycle` shows ONE role at a time, so a screen reader reaching
                it hears whichever happens to be mounted and never learns the
                other two exist. Carried over from the dark hero, where the same
                line exists for the same reason.
              */}
              <p className="sr-only">{roles.join(". ")}</p>
            </VvipRise>
          )}

          {titleText && (
            <VvipRise>
              <p className="vvip-title">{titleText}</p>
            </VvipRise>
          )}

          {/* The affiliation. Renders only when the logo slot is open, which is
              gated on a recorded permission in data/media.json. The legal name
              above stays as text either way; this accompanies it, it does not
              replace it.

              THERE IS NO LONGER A LABEL ABOVE THE MARK. It read "In affiliation
              with", and was removed on the site owner's instruction of
              2026-09-18: the title line directly above already names the council
              in full and names her role in it, so the label restated in six words
              what the sentence above it had just said properly. The affiliation
              is still carried in text by that title, not by the image, so
              removing the label costs nothing with images off. */}
          {organisationLogo && (
            <VvipRise>
              <div className="vvip-affiliation">
                {/* decorative: the organisation is already named in full in the
                    title directly above, so real alt text here would make a screen
                    reader announce the same name twice in a row. */}
                <OrganisationLogo
                  media={organisationLogo}
                  decorative
                  sizes="(max-width: 1024px) 60vw, 14rem"
                  className="vvip-affiliation-mark"
                />
              </div>
            </VvipRise>
          )}

          {meta.length > 0 && (
            <VvipRise>
              <dl className="vvip-meta">
                {meta.map((entry) => (
                  <div key={entry.label} className="vvip-meta-cell">
                    <dt className="vvip-meta-label">{entry.label}</dt>
                    <dd className="vvip-meta-value">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </VvipRise>
          )}

          <VvipRise>
            <div className="flex flex-wrap items-center gap-4">
              <Link href={contactHref} className="vvip-cta-primary">
                {t("contactCta")}
              </Link>
              <Link href={aboutHref} className="vvip-cta-secondary">
                {t("aboutCta")}
              </Link>
            </div>
          </VvipRise>
        </VvipStagger>

        {/* The portrait column. */}
        <VvipPortraitReveal className="relative mx-auto w-full max-w-md lg:max-w-none">
          {/*
            THE RATIO IS THE PHOTOGRAPH'S OWN, 1206x1748, NOT A CHOSEN 4/5.

            The box was `aspect-[4/5]` while the file is nearer 2/3, so the figure
            was always 80px shorter than the image it contained and the difference
            came off the bottom: a straight horizontal cut across her lap. With a
            framed, cropped photograph that is an ordinary editorial crop. With a
            CUT-OUT standing free on the page it is the figure being sliced, which
            is the exact artefact this column is meant not to have.

            Matching the container to the asset means the whole subject is always
            in view and the crop decision is made once, in the file, rather than
            twice and inconsistently.
          */}
          <figure className="vvip-portrait aspect-[1206/1748]">
            {portrait ? (
              <ProfileImage
                media={portrait}
                priority
                fill
                sizes="(max-width: 1024px) 100vw, 34rem"
                /*
                 * `object-contain`, not `object-cover`: see the note on
                 * `.vvip-portrait img` in styles/globals.css. A cut-out has no
                 * spare background to crop into, so `cover` can only take the
                 * subject.
                 */
                className="h-full w-full object-contain"
              />
            ) : (
              /*
               * THE EMPTY SLOT IS A FRAME, NOT A PLACEHOLDER GRAPHIC.
               *
               * `portrait` is gated by lib/media.ts and resolves to null until an
               * image is both supplied AND cleared for use. A stock silhouette
               * there would be a picture of a person who is not her, so the frame
               * holds its ratio and stays empty instead. The column keeps its
               * width either way, so the two-column grid does not collapse when
               * the slot is unfilled.
               */
              <div className="h-full w-full bg-[color:var(--surface-raised)]" />
            )}
          </figure>

          {/*
            THE IBC CORNER MARKS ARE GONE, AND THE FRAME IS WHY.

            Two blue squares sat over the panel's top-start and bottom-end corners,
            bracketing it the way a crop mark brackets a plate. That worked while
            there was a rectangle to bracket. With the panel removed (see
            `.vvip-portrait` in styles/globals.css) they marked the corners of a box
            that is no longer drawn, so they read as two blue squares floating in
            the white beside her, one of them detached in mid-air above her head.

            A registration mark for a frame that does not exist is decoration
            standing on nothing, so it is removed rather than repositioned. The
            accent still carries the identity in the places it is doing work: the
            eyebrow, the role line, the primary button and the rules.
          */}

          {/*
            BOTH HALVES ARE REQUIRED, and the guard is deliberate. An attribution
            with no statement is a stray name, and a statement with no attribution
            is an unsourced claim. Either alone is worse than neither, so the pair
            renders together or not at all.
          */}
          {statementText && statementAttribution && (
            <figcaption className="mt-7">
              <p className="vvip-statement">{statementText}</p>
              <p className="vvip-statement-attribution mt-3">{statementAttribution}</p>
            </figcaption>
          )}
        </VvipPortraitReveal>
      </div>
    </section>
  )
}
