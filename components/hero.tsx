import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { BackgroundImage, ProfileImage } from "@/components/profile-image"
import { SocialRow, type SocialLink } from "@/components/social-row"
import { type Stat } from "@/components/stat-bar"
import { HeroBackdrop } from "@/components/motion/objects"
import { localize, type LocalizedString } from "@/lib/localize"
import type { ResolvedMedia } from "@/lib/media"

/**
 * The opening band: an eyebrow, the name at display size, the roles beneath it,
 * and a location list.
 *
 * ── THE TYPEWRITER IS GONE, AND SO IS THE "use client" IT REQUIRED ──────────────
 *
 * This used to run the template's jQuery.typed effect reimplemented as a hook: the
 * roles cycled in and out one character at a time under a blinking cursor. Four
 * separate reasons it is not here any more, in order of how much they matter:
 *
 *   1. IT UNDERMINED THE CONTENT. This site exists to make a set of titles
 *      credible. A headline that types "Federation President" letter by letter,
 *      deletes it, and types something else presents those titles as ad copy —
 *      the exact register the rest of the build works to avoid. Every other
 *      decision here (naming organisations in full, marking unconfirmed dates as
 *      pending) is about not overselling; the hero was overselling.
 *
 *   2. IT IS THE SINGLE MOST RECOGNISABLE TEMPLATE EFFECT on a profile page.
 *
 *   3. IT FORCED AN ACCESSIBILITY WORKAROUND. The typed span was the page's only
 *      <h1>, so the document's primary heading was whatever had been typed at the
 *      moment a screen reader read it — sampled live, it announced "Civil Societ".
 *      The fix was a visually-hidden full title plus `aria-hidden` on the
 *      animation: two elements saying the same thing, one of them a lie to the
 *      accessibility tree. With static text the heading is simply the heading.
 *
 *   4. IT COST A CLIENT COMPONENT. The typewriter needed state, an effect and a
 *      `matchMedia` reduced-motion check, so the hero shipped as JS. Nothing left
 *      in it is interactive, so it is now a server component: no hydration, no
 *      bundle, and `localize` runs once on the server instead of on every client
 *      re-render.
 *
 * The roles are not lost — they are LISTED, which is also a better presentation of
 * them. All of them are visible at once, so they can be read and compared rather
 * than waited for, and a reader who wants the second title does not have to sit
 * through the first being deleted.
 *
 * ── THE BACKDROP ───────────────────────────────────────────────────────────────
 *
 * No portrait or event photography has been supplied (intake section 14 lists every
 * media asset as "not received"), so rather than a stock photo of someone who is
 * not the client, the ground is flat white with one gold rule.
 *
 * THE RADIAL GRADIENT AND THE 96px GRID ARE BOTH GONE. A soft glow over a faint
 * grid is the default "make it look designed" backdrop, and it was doing real harm
 * here beyond being familiar: a grid says software company, and this is a personal
 * professional profile. Flat ground with strong typography is the register the copy
 * holds.
 *
 * The `hero-background` slot still renders beneath everything when a real image
 * arrives — lib/media.ts returns null until that slot has a file, a recorded
 * permission and alt text — so this is a floor, not a placeholder awaiting deletion.
 */
export async function Hero({
  kicker,
  name,
  roles,
  title,
  locations,
  social = [],
  stats = [],
  contactHref,
  aboutHref,
  background = null,
  portrait = null,
}: {
  kicker: LocalizedString
  /** The short name — the document's subject, and now the <h1>. */
  name: string
  roles: string[]
  /** The full legal title. Rendered verbatim; never abbreviated to fit. */
  title: LocalizedString
  locations: { label: LocalizedString; value: LocalizedString }[]
  /** Empty today by design — SocialRow renders decoration rather than dead links. */
  social?: SocialLink[]
  /** Counted from published records only. See components/stat-bar.tsx. */
  stats?: Stat[]
  contactHref: string
  aboutHref: string
  /** The `hero-background` slot, already gated by lib/media.ts. Null today — the
   *  supplied files are 1206px wide and the slot requires 1920px, so the built
   *  backdrop below is the permanent ground rather than a wait state. */
  background?: ResolvedMedia | null
  /** The `portrait` slot, already gated by lib/media.ts. Cleared and rendering:
   *  it is what occupies the round frame in the second column. */
  portrait?: ResolvedMedia | null
}) {
  const locale = await getLocale()
  const t = await getTranslations("hero")

  /*
   * The meta row: experience, then the two location facts.
   *
   * ASSEMBLED HERE RATHER THAN TAKEN AS A PROP, because it is a presentation
   * decision — which facts belong in one row — not a data one. `stats` still
   * arrives from the page (counted through `publishable()`), and `locations` from
   * headline.json; this only decides how they sit together.
   *
   * `stats` is filtered the same way StatBar filtered it, so a cell the bar would
   * have dropped is dropped here too: an empty value, a literal "0", or a
   * `kind: "count"` tally below 2. That last rule is why "Positions held: 1" does
   * not appear — one record is a fact better carried by the Roles page, which
   * names it in full.
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

  return (
    /*
     * 88svh, NOT 100svh — and this is what replaces the scroll-down chevron.
     *
     * The old hero filled the viewport exactly and then had to announce that there
     * was more below it, with a bouncing `ChevronDown` pinned to the bottom edge.
     * That arrow is pure template vocabulary, and it was solving a problem the
     * layout had created for itself.
     *
     * Leaving 12% of the next section visible above the fold solves it instead, and
     * better: a partially-visible heading is an unambiguous, motionless signal that
     * scrolling continues, it needs no label to translate into three locales, and it
     * cannot be mistaken for a button. It is also what editorial sites actually do.
     *
     * svh rather than vh: on mobile Safari `vh` counts the retracting browser
     * chrome, so a 100vh band is taller than the visible area and the peek is
     * pushed off screen — the same reason --section-min uses svh.
     */
    <section
      id="top"
      /*
       * The hero is deliberately not a `.snap-section`, and the 88svh above is
       * why: the short band leaves a peek of the next section, which is what
       * signals the page continues.
       *
       * That class no longer carries scroll-snapping — snapping, and the
       * one-section-per-gesture controller that went with it, have been removed —
       * but it still sets the full-viewport floor, which is not what this band
       * wants.
       */
      className="relative flex min-h-[88svh] items-center overflow-hidden"
    >
      {/*
        THE BACKDROP, IN TWO LAYERS AND A STRICT ORDER.

        `BackgroundImage` first and `HeroBackdrop` second, so a real photograph —
        if the `hero-background` slot is ever filled — lands UNDER the built ground
        rather than over it. That is the right way round: the wash and horizon were
        tuned to sit against charcoal, and a photograph arriving would want them
        softening it, not being hidden by it.

        Today the slot is null (the supplied files are 1206px against a 1920px
        requirement), so only the second layer paints. It is a permanent floor.
      */}
      <BackgroundImage media={background} />
      <HeroBackdrop />

      {/*
        TWO COLUMNS, COLLAPSING TO ONE BELOW `lg`.
        `items-center` so the portrait frame and the text block share a centre line
        rather than both hanging from the top, which is what makes the circle look
        placed rather than dropped in.
      */}
      <div className="container-page relative z-10 grid items-center gap-14 py-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
        {/*
          THE `max-w-2xl` IS WHAT KEEPS THE COLUMN A BLOCK RATHER THAN A BAND.

          The page container is full-bleed, so on a wide monitor 1.15fr is several
          hundred pixels wider than this text ever wants to be. Without a cap the
          strapline and the intro sentence stretch to fill it and the left column
          stops reading as a composed block — the name, the rule and the copy all
          end at different, arbitrary places. Capping the column lets the grid keep
          growing while the type stays set to a measure someone chose.
        */}
        <div className="max-w-2xl">
          <p className="eyebrow mb-4" data-anime="eyebrow">
            {localize(kicker, locale)}
          </p>

          {/*
            THE NAME IS THE HEADING; THE ROLES ARE THE DISPLAY LINE.

            This inverts what the hero used to do. The <h1> was the full legal
            title — "President for Türkiye, International Federation for
            Businessmen and Women (IFB)" — set at up to 6rem, which is three lines
            of dense institutional naming before the reader learns whose page this
            is.

            The name comes first and carries the heading, because that is the
            document's actual subject. The roles follow at display size in the
            accent, and the full title sits beneath them at reading size — intact,
            unabbreviated, and still the first substantive thing after the name.

            The title is NOT shortened to fit the layout. scripts/check-publish-gate.mjs
            fails the build on abbreviating these organisation names, and the
            intake form requires them rendered verbatim; the layout was designed
            around that constraint rather than the constraint bent to the layout.
          */}
          {/*
            NO `data-anime="heading"` ON THIS ELEMENT, DELIBERATELY.

            That attribute used to opt an element into a per-word split reveal.
            The reveal is gone with the rest of the scroll motion, so this is now
            a rule about what NOT to reintroduce: this <h1> renders a real person's
            name, and a name is rendered verbatim and intact, never chopped into
            animated fragments. If a heading animation ever returns, it does not
            come back here.
          */}
          <h1 className="h1-big" data-anime="name">
            {name}
          </h1>

          {/*
            THE ROLE LINE, AND WHY IT IS `aria-hidden` WITH A LIST BESIDE IT.

            When the motion layer is active this line crossfades between her
            supplied roles (components/motion/hero.ts). An element whose text
            changes on a timer is hostile to a screen reader — it either announces
            mid-change or re-announces the same region every few seconds — so the
            ANIMATED element is hidden from the accessibility tree entirely and the
            complete, static list of roles is rendered immediately after it in
            `.sr-only`. Assistive technology gets every role at once, in order, and
            nothing it reads can change underneath it.

            This is also why the rotation is safe where the old typewriter was not:
            that one WAS the page's <h1>, so the document's primary heading changed
            character by character. The <h1> above is the name and never animates.

            `data-roles` carries the full list to the client as JSON. Without the
            motion layer the element simply shows `roles[0]` — the server-rendered
            text — which is a complete and correct hero.
          */}
          {roles.length > 0 && (
            <>
              <p
                aria-hidden
                data-anime="role-lead"
                data-roles={JSON.stringify(roles)}
                className="mt-3 font-display text-[clamp(1.75rem,4.5vw,3.25rem)] leading-[1.1] tracking-[-0.02em] text-[color:var(--primary)]"
              >
                {roles[0]}
              </p>
              <p className="sr-only">{roles.join(". ")}</p>
            </>
          )}

          <div aria-hidden data-anime="hero-rule" className="mt-7 h-px w-16 bg-[color:var(--primary)]" />

          {/* The full legal title. Body size, held to the measure, verbatim. */}
          <p
            data-anime="hero-title"
            className="measure mt-6 text-base leading-relaxed text-[color:var(--card-foreground)]"
          >
            {localize(title, locale)}
          </p>

          {/*
            ── THE META ROW ────────────────────────────────────────────────────

            ONE ROW, THREE FACTS, ONE TREATMENT. What stood here was four separate
            blocks stacked down the column — the remaining roles as a list, a stat
            bar in a bordered box, and a locations list — each with its own
            spacing, its own type size and its own label style. Read top to bottom
            they were a pile of fragments rather than a profile, and two of them
            said the same thing twice: "Business Development" and "Strategic
            Partnerships" were already cycling in the role line above, and "Years
            experience" appeared both as a stat-bar label and again in the row
            beneath it.

            So the duplicates are gone and what remains is ONE row of labelled
            facts, sharing the eyebrow label treatment used for metadata
            everywhere else on the site. Three columns on desktop, wrapping to two
            then one, with a hairline between them rather than a box around each —
            the rule does the separating that four boxes were doing badly.

            The roles are NOT lost to assistive technology: the `.sr-only` list
            beside the rotating line above already carries all of them in order.
          */}
          {meta.length > 0 && (
            <dl
              data-anime="hero-meta"
              className="mt-10 flex flex-wrap gap-x-10 gap-y-6 border-t border-[color:var(--border)] pt-7"
            >
              {meta.map((m) => (
                <div key={m.label} className="min-w-[8rem]">
                  <dt className="eyebrow mb-1.5 block">{m.label}</dt>
                  <dd className="text-sm leading-relaxed text-[color:var(--card-foreground)]">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div data-anime="hero-cta" className="mt-9 flex flex-wrap items-center gap-4">
            <Link href={contactHref} className="btn-main btn-pill">
              {t("contactCta")}
            </Link>
            <Link href={aboutHref} className="btn-outline btn-pill">
              {t("aboutCta")}
            </Link>
          </div>

          <SocialRow links={social} className="mt-9" />
        </div>

        {/*
          ── THE PORTRAIT COLUMN ─────────────────────────────────────────────────

          THE DISC IS GONE, AND THAT IS THE POINT.

          This was a circular frame: `SectionFigure` with `rounded-full`, a raised
          surface fill and a blurred gold halo behind it, all of which existed to
          manage one problem — the photograph was shot on a white seamless, so on a
          near-black ground the circle landed as the brightest, hardest edge on the
          page. Every one of those treatments was compensation for the white, and a
          halo added to soften a hard edge is still a hard edge with a glow around
          it.

          The white is now removed at the source instead:
          scripts/build-portrait-cutout.mjs ramps the seamless out to transparency
          and writes the `-cutout.png` that data/media.json points at. With no white
          left there is nothing to contain, so the figure sits directly on the page
          ground and the frame, the fill and the halo all become unnecessary.

          What replaces them is a MASK, not a frame: the image fades to nothing at
          its bottom and outer edges, so she emerges from the ground rather than
          being pasted onto it. There is no border anywhere in this block.
        */}
        <div className="relative mx-auto w-full max-w-[22rem] lg:max-w-none">
          {/*
            The light she is standing in.

            A warm, off-centre bloom placed BEHIND the figure and biased to the
            portrait side, so the brightest part of the ground sits just behind her
            shoulder — the same place a key light would fall in the studio the
            photograph came from. It is what stops the cutout reading as a flat
            sticker: a figure with no light behind it has no depth to occupy.

            aria-hidden decoration at z-0, beneath the photograph, so nothing is
            ever drawn over the subject herself.
          */}
          <div
            aria-hidden
            data-hero="portrait-glow"
            className="pointer-events-none absolute -inset-x-10 -inset-y-12 -z-0 blur-3xl"
            style={{
              background:
                "radial-gradient(60% 55% at 62% 38%, rgba(var(--primary-rgb), 0.22), rgba(var(--primary-rgb), 0.07) 45%, transparent 70%)",
            }}
          />

          {/*
            `data-hero="portrait"` is the parallax hook — components/motion/hero.ts
            drifts this wrapper a few pixels against the pointer. The transform goes
            on this element rather than the <img> so the mask below moves with the
            photograph instead of sliding across it.
          */}
          <div data-hero="portrait" className="relative z-10 will-change-transform">
            <ProfileImage
              media={portrait}
              priority
              sizes="(max-width: 1024px) 22rem, 34rem"
              className="h-auto w-full select-none object-contain"
              /*
               * THE FADE IS A MASK, NOT A GRADIENT OVERLAY, and the difference
               * matters on a page whose ground is not a flat colour. An overlay
               * would have to paint the exact backdrop colour on top of the image
               * to hide its edge — and the backdrop behind her is a gold bloom, not
               * a flat value, so any painted colour would be visibly wrong wherever
               * the two disagreed.
               *
               * A mask removes the pixels instead, so whatever is behind shows
               * through correctly by construction. The bottom fade is the longer of
               * the two because that edge is where the photograph is cropped by the
               * frame; the sides only need their corners softened.
               */
              style={{
                maskImage:
                  "linear-gradient(to bottom, #000 0%, #000 62%, rgba(0,0,0,0.55) 84%, transparent 100%), radial-gradient(75% 85% at 50% 42%, #000 60%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, #000 0%, #000 62%, rgba(0,0,0,0.55) 84%, transparent 100%), radial-gradient(75% 85% at 50% 42%, #000 60%, transparent 100%)",
                maskComposite: "intersect",
                WebkitMaskComposite: "source-in",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
