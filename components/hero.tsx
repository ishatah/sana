import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { BackgroundImage, ProfileImage } from "@/components/profile-image"
import { SocialRow, type SocialLink } from "@/components/social-row"
import { type Stat } from "@/components/stat-bar"
import { HeroBackdrop } from "@/components/motion/objects"
/* A client component rendered from this server one, a valid boundary, and the
   reason `Hero` does not itself need "use client". Only the canvas and its effect
   ship to the browser; every `localize` call above still runs once on the server. */
/* Same boundary, same reason: the role line animates on the client, but the roles
   themselves were localized on the server and arrive here as finished strings. */
import { RoleCycle } from "@/components/motion/fm/role-cycle"
/* The portrait's scroll camera. Takes the server-rendered <ProfileImage> as
   children, so the image and its mask are still resolved on the server. */
import { HeroCamera } from "@/components/motion/fm/hero-camera"
/* The mask sweep on the title line. Same boundary and same reason as the two
 * above: the string is localized on the server and arrives here finished. The
 * client component animates ONE CSS property on the whole element and never
 * touches the text node, see the no-split note in that file.
 *
 * (Every line of this comment is led by an asterisk deliberately. The source
 * scan in scripts/check-publish-gate.mjs skips lines whose first non-space
 * character is `*`, `//` or `/*`, so a continuation line that starts with a bare
 * word is read as CODE, which is how an earlier wording of this note, naming
 * the banned identifier in prose, failed the gate it was describing.) */
import { SweepText } from "@/components/motion/fm/sweep-text"
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
 *      deletes it, and types something else presents those titles as ad copy,
 *      the exact register the rest of the build works to avoid. Every other
 *      decision here (naming organisations in full, marking unconfirmed dates as
 *      pending) is about not overselling; the hero was overselling.
 *
 *   2. IT IS THE SINGLE MOST RECOGNISABLE TEMPLATE EFFECT on a profile page.
 *
 *   3. IT FORCED AN ACCESSIBILITY WORKAROUND. The typed span was the page's only
 *      <h1>, so the document's primary heading was whatever had been typed at the
 *      moment a screen reader read it, sampled live, it announced "Civil Societ".
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
 * The roles are not lost, they are LISTED, which is also a better presentation of
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
 * arrives, lib/media.ts returns null until that slot has a file, a recorded
 * permission and alt text, so this is a floor, not a placeholder awaiting deletion.
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
  statement = null,
}: {
  kicker: LocalizedString
  /** The short name, the document's subject, and now the <h1>. */
  name: string
  roles: string[]
  /** The full legal title. Rendered verbatim; never abbreviated to fit. */
  title: LocalizedString
  locations: { label: LocalizedString; value: LocalizedString }[]
  /** Empty today by design, SocialRow renders decoration rather than dead links. */
  social?: SocialLink[]
  /** Counted from published records only. See components/stat-bar.tsx. */
  stats?: Stat[]
  contactHref: string
  aboutHref: string
  /** The `hero-background` slot, already gated by lib/media.ts. Null today, the
   *  supplied files are 1206px wide and the slot requires 1920px, so the built
   *  backdrop below is the permanent ground rather than a wait state. */
  background?: ResolvedMedia | null
  /** The `portrait` slot, already gated by lib/media.ts. Cleared and rendering:
   *  it is what occupies the round frame in the second column. */
  portrait?: ResolvedMedia | null
  /** The signed personal statement under the portrait. Optional: the hero is
   *  complete without it, so an absent or half-filled record renders nothing
   *  rather than a dangling signature. */
  statement?: { text: LocalizedString; attribution: LocalizedString } | null
}) {
  const locale = await getLocale()
  const t = await getTranslations("hero")

  /*
   * The meta row: experience, then the two location facts.
   *
   * ASSEMBLED HERE RATHER THAN TAKEN AS A PROP, because it is a presentation
   * decision, which facts belong in one row, not a data one. `stats` still
   * arrives from the page (counted through `publishable()`), and `locations` from
   * headline.json; this only decides how they sit together.
   *
   * `stats` is filtered the same way StatBar filtered it, so a cell the bar would
   * have dropped is dropped here too: an empty value, a literal "0", or a
   * `kind: "count"` tally below 2. That last rule is why "Positions held: 1" does
   * not appear, one record is a fact better carried by the Roles page, which
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

  /*
   * Localized once here rather than inline in the JSX, because both halves are
   * tested before either renders, see the figure below for why the pair is
   * all-or-nothing.
   */
  const statementText = statement ? localize(statement.text, locale).trim() : ""
  const statementAttribution = statement ? localize(statement.attribution, locale).trim() : ""

  return (
    /*
     * 70svh, AND IT IS A FLOOR THE CONTENT NORMALLY CLEARS.
     *
     * This was 88svh, which was NOT what set the height: measured at 1497x900 the
     * band came out 973px against a 792px floor, because the portrait column plus
     * py-24 was taller than the floor and the image was driving the section. The
     * hero overflowed the viewport while the text column ended 240px above the
     * bottom edge, the "empty space" was that slack, under a portrait already
     * faded to nothing by its own mask.
     *
     * Three things were changed together, because trimming padding alone would not
     * have touched the cause: the portrait is capped (26rem on lg), the grid
     * padding came down from py-24, and this floor dropped to 70svh. The band is
     * now ~715px at that viewport and sized BY ITS CONTENT, with the remaining
     * space below the columns being the grid's own symmetric padding.
     *
     * THE PEEK STILL WORKS, and is now larger rather than smaller: a shorter band
     * leaves more of the next section above the fold, which is the motionless
     * signal that the page continues, the reason there is no scroll chevron here.
     *
     * svh rather than vh: on mobile Safari `vh` counts the retracting browser
     * chrome, so a 100vh band is taller than the visible area and the peek is
     * pushed off screen, the same reason --section-min uses svh.
     */
    <section
      id="top"
      /*
       * The hero is deliberately not a `.snap-section`, and the 70svh above is
       * why: the short band leaves a peek of the next section, which is what
       * signals the page continues.
       *
       * That class no longer carries scroll-snapping, snapping, and the
       * one-section-per-gesture controller that went with it, have been removed,
       * but it still sets the full-viewport floor, which is not what this band
       * wants.
       */
      className="relative flex min-h-[70svh] items-center overflow-hidden"
    >
      {/*
        THE BACKDROP, IN TWO LAYERS AND A STRICT ORDER.

        `BackgroundImage` first and `HeroBackdrop` second, so a real photograph,
        if the `hero-background` slot is ever filled, lands UNDER the built ground
        rather than over it. That is the right way round: the wash and horizon were
        tuned to sit against charcoal, and a photograph arriving would want them
        softening it, not being hidden by it.

        Today the slot is null (the supplied files are 1206px against a 1920px
        requirement), so only the second layer paints. It is a permanent floor.
      */}
      <BackgroundImage media={background} />
      <HeroBackdrop />

      {/*
        EFFECTS 42, 43 AND 17, three atmospheric layers, in a fixed order, all
        under the existing backdrop's z-order and all pointer-events: none.

        THE ORDER IS BY ALPHA, DARKEST FIRST. Mesh (five stops, ≤0.09) sits
        under aurora (two conic sweeps at 0.5 layer opacity) which sits under the
        gold bloom (a single 0.06 radial). Reversing any pair would put a broader
        wash over a narrower one and the narrower one would stop reading.

        THEY ARE ALL aria-hidden. None carries information, the hero's meaning
        is entirely in the text column beside them, so announcing them would be
        noise, and there is nothing for an alt to say.

        THE COMPOSITE STAYS UNDER THE TEXT'S CONTRAST FLOOR BY CONSTRUCTION: the
        highest stop in any of the three is 0.09, and they sum to roughly six
        luminance steps above #0A0A0B at the brightest point. The hero's
        --heading text measures 15.4:1 on the declared ground and about 14.9:1 at
        that worst point, so nothing here needs a per-layer recomputation.
      */}
      {/* The aurora (two drifting conic sweeps) and the bloom (one centred radial)
          are both gone: each read as a glowing circle rather than as atmosphere.
          `.mesh-hero` now paints a flat block-axis ramp and carries the ground on
          its own. */}
      <div aria-hidden className="mesh-hero" />

      {/*
        THE SHADER LAYER, third, and third for a reason.

        It sits ABOVE the two ground layers and BELOW the content grid (`z-10`), so
        the order down the stack is: photograph if one ever arrives → built gradient
        ground → moving light → type and portrait. Nothing is ever drawn over the
        subject or the copy.

        WHY IT DOES NOT REPLACE `HeroBackdrop`. The shader paints rays; it does not
        paint edges. The vignette, the top-and-bottom seats and the horizon are what
        give this band its shape, and they are tuned to the charcoal. The shader
        clears to TRANSPARENT and blends additively (see components/ui/web-gl-shader.tsx),
        so it adds movement to that ground rather than standing in for it.

        THE SETTINGS ARE WELL BELOW THE COMPONENT'S OWN DEFAULTS, and the portrait
        is why. This band's subject is a photograph of a person; a bright animated
        field behind her would compete with the one thing the hero exists to show.
        `opacity` at 0.3 and `distortion` at 0.03 put the rays at roughly the weight
        of the existing warm wash, present as texture, not as an event. `speed` at
        0.35 keeps the drift slow enough that it is never caught moving in
        peripheral vision while the headline is being read.

        REDUCED MOTION IS HANDLED INSIDE THE COMPONENT, not here: it renders one
        static frame and never schedules a loop. That is why this is not wrapped in
        a preference check of its own, a still ray field is a legitimate ground,
        so there is nothing to suppress.
      */}
      {/*
        `xScale` 0.55 and `yScale` 0.9 are what make the field cover the whole band.

        The rays follow p.y = -sin(x * xScale) * yScale, so those two numbers ARE
        the geometry: yScale is how far the band swings vertically and xScale is how
        many times it oscillates across the width. At the previous 1.0 / 0.42 the
        band was a shallow wave confined to the middle third, which is why it ran
        out partway across and left the corners empty, the light had an end, and an
        end is an edge.

        Lower xScale stretches one wave across the full width; higher yScale lets it
        reach the top and bottom. The result sweeps the entire hero, so every ray
        leaves through a corner rather than stopping in open ground.
      */}
      {/*
        THE SHADER IS GONE, and what replaced it spans the whole page rather than
        this one band.

        It painted a diagonal ray field confined to the hero: a light that began
        and ended at the hero's own box, which is the same discontinuity the
        per-band washes had. `<SectionThread />` in app/[locale]/page.tsx is the
        replacement, ONE glowing line that enters here and runs through every
        section below, so the hero opens the page's line instead of owning a
        separate effect that stops at its floor.
      */}

      {/*
        TWO COLUMNS, COLLAPSING TO ONE BELOW `lg`.
        `items-center` so the portrait frame and the text block share a centre line
        rather than both hanging from the top, which is what makes the circle look
        placed rather than dropped in.
      */}
      <div className="container-page relative z-10 grid items-center gap-10 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20 lg:py-10">
        {/*
          THE `max-w-2xl` IS WHAT KEEPS THE COLUMN A BLOCK RATHER THAN A BAND.

          The page container is full-bleed, so on a wide monitor 1.15fr is several
          hundred pixels wider than this text ever wants to be. Without a cap the
          strapline and the intro sentence stretch to fill it and the left column
          stops reading as a composed block, the name, the rule and the copy all
          end at different, arbitrary places. Capping the column lets the grid keep
          growing while the type stays set to a measure someone chose.
        */}
        <div className="max-w-2xl">
          {/*
            THE LEAD-IN, SET LARGE RATHER THAN AS A LABEL.

            This carried `.eyebrow`, the 12px tracked-out uppercase treatment used
            for metadata everywhere else on the site, and the string was the whole
            sentence, "I am Sanae Rakik". Two things were wrong with that. The name
            was printed twice a line apart, the second time at display size in the
            <h1>; and a lead-in set at label size reads as a caption on the name
            rather than as the opening of a sentence the name completes.

            It is now two words at roughly a third of the display size, which makes
            the pair read as one utterance: a quiet "I am", then the name at full
            scale. `font-display` and the same negative tracking as `.h1-big` keep
            the two in the same voice; the lighter colour keeps the name dominant.

            NOT UPPERCASED. `.eyebrow` uppercases, which would render "I AM", fine
            in English and meaningless in Arabic, which has no letter case. The
            string is authored as it should read in data/headline.json.
          */}
          <p
            className="mb-1 font-display text-[clamp(1.25rem,2.6vw,2rem)] leading-none tracking-[-0.02em] text-[color:var(--muted-foreground)]"
            data-anime="eyebrow"
          >
            {localize(kicker, locale)}
          </p>

          {/*
            THE NAME IS THE HEADING; THE ROLES ARE THE DISPLAY LINE.

            This inverts what the hero used to do. The <h1> was the full legal
            title, "President for Türkiye, International Federation for
            Businessmen and Women (IFB)", set at up to 6rem, which is three lines
            of dense institutional naming before the reader learns whose page this
            is.

            The name comes first and carries the heading, because that is the
            document's actual subject. The roles follow at display size in the
            accent, and the full title sits beneath them at reading size, intact,
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
          {/*
            EFFECT 12 (per-letter stagger) IS NOT APPLIED HERE, and this is the
            one requested effect that could not be placed anywhere.

            It needs the text split into per-letter spans. The rule directly
            above forbids exactly that on this element: this <h1> is a real
            person's name, rendered verbatim and intact, never chopped into
            animated fragments. That rule is not stylistic and it does not yield
            to a colour effect, so .letter-stagger is built in globals.css and
            deliberately has no call site.

            EFFECT 36 IS THE SUBSTITUTE, and it reaches the same goal by the
            means this element allows: .name-glow warms the ground behind the
            letterforms with a 40px text-shadow, which is a property of the
            whole element and needs no split at all. The text node is untouched,
            so the accessible name is still one string.
          */}
          <h1 className="h1-big name-glow" data-anime="name">
            {name}
          </h1>

          {/*
            THE ROLE LINE, AND WHY IT IS `aria-hidden` WITH A LIST BESIDE IT.

            When the motion layer is active this line crossfades between her
            supplied roles (components/motion/hero.ts). An element whose text
            changes on a timer is hostile to a screen reader, it either announces
            mid-change or re-announces the same region every few seconds, so the
            ANIMATED element is hidden from the accessibility tree entirely and the
            complete, static list of roles is rendered immediately after it in
            `.sr-only`. Assistive technology gets every role at once, in order, and
            nothing it reads can change underneath it.

            This is also why the rotation is safe where the old typewriter was not:
            that one WAS the page's <h1>, so the document's primary heading changed
            character by character. The <h1> above is the name and never animates.

            `data-roles` carries the full list to the client as JSON. Without the
            motion layer the element simply shows `roles[0]`, the server-rendered
            text, which is a complete and correct hero.
          */}
          {roles.length > 0 && (
            <>
              {/*
                `inline-block` and `whitespace-nowrap` are what let the line
                RESHAPE between roles rather than just swapping text inside a
                full-width block.

                As a block <p> the element filled the column, so its box was the
                same width for "Entrepreneur" as for "Strategic Partnerships" and
                there was no edge for the motion layer to animate, the width
                transition would have been measuring a constant. Shrink-wrapped,
                the box is the text, and its trailing edge is a real thing that
                can move.

                `whitespace-nowrap` keeps each role on ONE line, so the box that
                reshapes is a single moving edge rather than a block changing
                height. A role allowed to wrap would reshape on both axes and read
                as reflow rather than as a transition.

                NO-JS FLOOR UNCHANGED. Without the motion layer this is still just
                `roles[0]` at its natural width, an inline-block that never
                animates looks identical to the block it replaced. `RoleCycle`
                renders exactly that markup under reduced motion, and its
                `AnimatePresence initial={false}` guarantees the first role is
                server-rendered visible even with the bundle absent.

                ── TWO LAYERS, TWO ELEMENTS, NO OVERLAP ──────────────────────────

                `data-anime="role-lead"` stays on this WRAPPER: the hero's
                entrance stagger in components/motion/hero.ts fades the wrapper in
                on load. The rotation inside it belongs to the Framer layer
                (components/motion/fm/role-cycle.tsx). Neither writes a property
                the other writes, see the ownership rule in
                components/motion/fm/variants.ts.

                `data-roles` is gone with `rotateRoles()`. The list is passed as a
                real prop now rather than round-tripped through a JSON attribute.
              */}
              <span data-anime="role-lead" className="mt-3 inline-block">
                <RoleCycle
                  roles={roles}
                  className="inline-block whitespace-nowrap font-display text-[clamp(1.75rem,4.5vw,3.25rem)] leading-[1.1] tracking-[-0.02em] text-[color:var(--primary)]"
                />
              </span>
              <p className="sr-only">{roles.join(". ")}</p>
            </>
          )}

          {/* The full legal title. Body size, held to the measure, verbatim. */}
          {/*
            SET AT clamp(1.0625rem, 1.5vw, 1.3125rem) RATHER THAN text-base.

            This line is the hero's only substantive sentence, it is the title the
            whole band exists to make credible, and at a flat 16px it sat at the
            same size as the meta values beneath it and BELOW the statement opposite
            in perceived weight, because that column is narrower. A sentence that
            outranks everything under it should not be set at the size of the labels
            it outranks. It scales with the viewport now so the relationship to the
            role line above holds at every width rather than only at the one it was
            eyeballed at.

            `text-[color:var(--foreground)]` rather than --card-foreground: the
            muted card tone is right for the supporting rows below, and wrong for
            the one line that is not supporting anything.
          */}
          {/*
            NO `data-anime="hero-title"` ANY MORE, AND THAT IS THE WHOLE POINT.

            This line used to be one more entry in the hero's opacity-and-rise
            sequence (components/motion/hero.ts), which is the same entrance the
            six elements around it get. Six things rising by 18px in turn is a
            sequence; it is not an effect on the sentence itself.

            `SweepText` uncovers it with a travelling mask instead, so the title
            reads as being WRITTEN rather than as another block sliding in. The
            two mechanisms cannot both own this element, the vanilla layer writes
            an inline `transform`/`opacity` and would be animating a line the mask
            is still hiding, so the hook is removed here rather than left on
            alongside. That is the ownership rule in components/motion/fm/variants.ts.

            `delay={390}` is the exact beat the removed sequence entry held, so
            the choreography is unchanged; only what happens at that beat is.
          */}
          <SweepText
            delay={390}
            className="measure mt-6 text-[clamp(1.0625rem,1.5vw,1.3125rem)] leading-relaxed text-[color:var(--foreground)]"
          >
            {localize(title, locale)}
          </SweepText>

          {/*
            ── THE META ROW ────────────────────────────────────────────────────

            ONE ROW, THREE FACTS, ONE TREATMENT. What stood here was four separate
            blocks stacked down the column, the remaining roles as a list, a stat
            bar in a bordered box, and a locations list, each with its own
            spacing, its own type size and its own label style. Read top to bottom
            they were a pile of fragments rather than a profile, and two of them
            said the same thing twice: "Business Development" and "Strategic
            Partnerships" were already cycling in the role line above, and "Years
            experience" appeared both as a stat-bar label and again in the row
            beneath it.

            So the duplicates are gone and what remains is ONE row of labelled
            facts, sharing the eyebrow label treatment used for metadata
            everywhere else on the site. Three columns on desktop, wrapping to two
            then one, with a hairline between them rather than a box around each,
            the rule does the separating that four boxes were doing badly.

            The roles are NOT lost to assistive technology: the `.sr-only` list
            beside the rotating line above already carries all of them in order.
          */}
          {/* `.block-rule` rather than `border-t`: a hairline across the full
              column reads as a table starting, and these facts elaborate the name
              above them rather than being cut off from it. See styles/globals.css. */}
          {meta.length > 0 && (
            <dl
              data-anime="hero-meta"
              className="block-rule mt-10 flex flex-wrap gap-x-10 gap-y-6 pt-7"
            >
              {/*
                THE VALUES CARRY `.meta-value`, THE LABELS `.eyebrow-lg`.

                Both were a size too small for what they are. The values were
                `text-sm`, 14px for "Netherlands" and "10+ years", which are FACTS
                about the subject sitting directly under her name, not footnotes,
                and the labels rode the default 12px `.eyebrow`, which is the size
                used for captions three sections further down the page. In the hero
                they read as fine print attached to display type.

                `.meta-value` (styles/globals.css) sets them at
                clamp(1.05rem, 1.6vw, 1.35rem), which puts them a clear step above
                the sentence they follow and gives the row its own voice rather than
                a smaller copy of the body's. `.eyebrow-lg` lifts the label to 13px
                and keeps everything else about `.eyebrow`, including the RTL rule
                that drops the uppercase transform, which is why it is a modifier
                and not a replacement class.

                `data-anime="meta-item"` is the per-cell entrance hook. The spacing
                between cells is NOT declared here, components/motion/hero.ts
                matches this selector once and its `stagger()` spaces however many
                elements it found, so the beat lives with the rest of the
                choreography rather than being half in the markup.
              */}
              {meta.map((m) => (
                <div key={m.label} data-anime="meta-item" className="min-w-[8rem]">
                  <dt className="eyebrow eyebrow-lg mb-2 block">{m.label}</dt>
                  <dd className="meta-value text-[color:var(--foreground)]">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div data-anime="hero-cta" className="mt-9 flex flex-wrap items-center gap-4">
            <Link href={contactHref} className="btn-main cta-fill">
              {t("contactCta")}
            </Link>
            <Link href={aboutHref} className="btn-outline">
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
          manage one problem, the photograph was shot on a white seamless, so on a
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
        {/*
          THE `lg:max-w-[26rem]` CAP IS A HEIGHT CONTROL, NOT A WIDTH PREFERENCE.

          This was `lg:max-w-none`, so the column took its full grid track (0.85fr)
          and the portrait rendered 781px tall, taller than the text column's 494px
          and taller than the band's own floor, which made the IMAGE the thing
          setting the hero's height. Capping the width caps the height with it
          (the photograph keeps its 1.449 ratio), so the band is sized by the
          composition rather than by how wide the viewport happens to be.
        */}
        <div className="relative mx-auto w-full max-w-[19rem] lg:max-w-[26rem]">
          {/*
            ── THERE IS NO BLOOM BEHIND HER, AND THE SEPARATION IS IN THE FILE ────

            This column used to carry a warm elliptical wash at z-0, described as
            the key light she is standing in, on the argument that a figure with no
            light behind it has no depth to occupy. The element is gone: on a page
            that is now black end to end it was the last off-centre tinted radial
            left, and it read as exactly what the discs before it read as, a glow
            placed under the subject rather than light falling on her.

            What replaced it is a fix at the source rather than a layer on top.
            The cutout's edge used to keep a 2-4px rim of the white seamless it was
            shot against, fully opaque (measured: 1,642 bright pixels sitting
            directly against transparency), and THAT was what made her read as a
            sticker, an outline lit by nothing in the scene. A bloom behind the
            figure does not remove that rim, it backlights it.

            scripts/build-portrait-cutout.mjs now ramps alpha across the blend band
            and un-premultiplies the seamless out of the colour of every partly
            transparent pixel, so the edge carries her own colour at partial
            coverage and composites correctly onto whatever is behind it. The rim
            measures zero. She meets the ground directly, which is why nothing has
            to be painted behind her to explain the join.
          */}

          {/*
            TWO NESTED ELEMENTS, ONE EFFECT EACH, and the nesting is the point.

            `data-hero="portrait"` is the ENTRANCE hook. components/motion/hero.ts
            fades this wrapper in and settles it back from a slight push-in on
            load, once, and never touches it again.

            `HeroCamera` inside it owns the SCROLL behaviour: as the hero leaves,
            the portrait recedes in Z, tilts, trails downward and dims. That
            replaces the old `portraitDrift()`, which scrubbed this same wrapper
            8px, those 8px are now one term of the camera's transform.

            THEY CANNOT SHARE A NODE. Both write `opacity` and `scale`; the
            entrance writes them as a composed inline `transform` string
            (components/motion/dom.ts) and the camera writes them from its own
            MotionValues. Same properties, same element, two writers, whichever
            ran last would win each frame and the portrait would visibly fight
            itself at a rate depending on scroll speed. Splitting them across
            parent and child gives each its own node and its own property, which
            is the ownership rule in components/motion/fm/variants.ts.

            The transform goes on these wrappers rather than the <img> so the mask
            below moves with the photograph instead of sliding across it.

            `will-change-transform` stays HERE and is not repeated inside. One
            promoted layer is enough for a 34rem image; a second would be a second
            permanent GPU allocation for no gain.
          */}
          <div data-hero="portrait" className="relative z-10 will-change-transform">
            <HeroCamera>
            <ProfileImage
              media={portrait}
              priority
              sizes="(max-width: 1024px) 22rem, 34rem"
              /*
               * THE PORTRAIT RENDERS IN FULL COLOUR, and the duotone that was
               * briefly here has been removed rather than softened.
               *
               * It mapped the photograph's shadows to the ground and its
               * highlights to the accent, which is a treatment that works on a
               * stock image used as texture. This is the subject's own
               * photograph on her own profile, recolouring it makes the site's
               * palette the loudest thing about the one element that is
               * genuinely hers. Full colour is the correct default here, and the
               * `.duotone` rule stays in globals.css unused rather than being
               * deleted, so the treatment is recoverable for a decorative image.
               *
               * EFFECT 40 IS ALSO NOT ADDED HERE even though the portrait is the
               * obvious place for an edge fade: the client has asked that the
               * supplied cut-out's edges be left alone, so an edge fade is
               * exactly what must not be added here. `.edge-fade` would also
               * install a second mask-image on this element and the later
               * declaration would replace the bottom-of-frame dissolve below
               * with a generic 12%/88% ramp, reinstating a side fade as a
               * side effect of the one that is deliberately gone.
               */
              className="h-auto w-full select-none object-contain"
              /*
               * ── THE RADIAL IS GONE. NOTHING TOUCHES THE SILHOUETTE ANY MORE ────
               *
               * This carried two masks composited together: a linear fade down the
               * block axis AND a radial that softened the sides and corners. The
               * radial is removed at the client's explicit instruction that no edge
               * treatment be applied to the supplied cut-out.
               *
               * It was also obsolete on its own terms. It existed because the
               * portrait used to be derived from a studio shot on a white seamless,
               * where the matte could not be trusted at the outline and a soft
               * corner hid what it got wrong. The file rendered now arrives with the
               * background already removed and its edges intact (data/media.json),
               * so softening them is subtracting from a good matte rather than
               * rescuing a poor one.
               *
               * ── WHAT REMAINS IS NOT AN EDGE EFFECT ────────────────────────────
               *
               * The linear fade is kept, and it is a different thing from the
               * radial: it does not touch the OUTLINE, it dissolves the BOTTOM OF
               * THE FRAME. Measured on the supplied file, rows at 94-97% of its
               * height are opaque edge to edge (1206/1206 px), so without this the
               * photograph would end in a hard horizontal line straight across the
               * column, the photograph visibly stopping rather than ending.
               *
               * 86% to 100% keeps her present almost to the frame edge and spends
               * only the last sliver dissolving, so no layout height is wasted on
               * empty ground.
               *
               * A MASK RATHER THAN A GRADIENT OVERLAY: an overlay would have to
               * paint the backdrop colour over the image to hide the edge, which is
               * only correct while the backdrop is exactly that colour. A mask
               * removes the pixels, so whatever is behind shows through by
               * construction.
               */
              style={{
                maskImage:
                  "linear-gradient(to bottom, #000 0%, #000 86%, rgba(0,0,0,0.55) 96%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, #000 0%, #000 86%, rgba(0,0,0,0.55) 96%, transparent 100%)",
              }}
            />
            </HeroCamera>
          </div>

          {/*
            ── THE SIGNED STATEMENT ────────────────────────────────────────────

            Placed INSIDE the portrait column and after the image, so it reads as
            her caption rather than as a fourth block in the left-hand stack. The
            column is capped at 26rem, which also sets this text's measure, about
            45 characters, close to the comfortable range for a short passage, and
            narrow enough that it reads as an aside to the portrait rather than
            competing with the title block opposite.

            BOTH HALVES ARE REQUIRED. An attribution with no statement is a stray
            name and a statement with no attribution is an unsourced claim, so the
            pair renders only when both strings survive `localize`. That is also
            why `statement` is optional at the type level: the hero above is a
            complete composition without it.

            NOT A <blockquote>. She is the author of the page and of the sentence,
            so this is not a quotation from elsewhere, it is the subject speaking
            in her own document. Marking it as a quote would imply a source outside
            the page. The signature is a <cite> for the name only.

            `mt-8` and the hairline above it separate this from the photograph
            without drawing a box: the same rule treatment the meta row opposite
            uses, so the two columns close the same way.
          */}
          {statementText && statementAttribution && (
            <figure
              data-anime="hero-statement"
              className="mt-8 border-t border-[color:var(--border)] pt-6"
            >
              {/*
                `text-[0.975rem]` rather than `text-sm`. This is a paragraph someone
                wrote in the first person and signed; at 14px in a 26rem column it
                read as a legal footer under the photograph. The bump is small on
                purpose, it has to stay quieter than the title block opposite,
                but it is enough that the passage reads as prose rather than as
                fine print.
              */}
              <p className="text-[0.975rem] leading-relaxed text-[color:var(--card-foreground)]">
                {statementText}
              </p>
              <figcaption className="eyebrow mt-4 text-[color:var(--primary-strong)]">
                <cite className="not-italic">{statementAttribution}</cite>
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </section>
  )
}
