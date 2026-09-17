import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
/* The light IBC-blue hero. The dark/gold original stays at components/hero.tsx:
   swap this import back to restore it, no other edit needed — the two share a
   prop contract precisely so the theme can be reversed in one line. */
import { HeroVvip as Hero } from "@/components/hero-vvip"
import { SectionHeader } from "@/components/section-header"
import { AboutSection } from "@/components/about-section"
import { ExpertiseGrid } from "@/components/expertise-grid"
import { RoleEntryList, composeRoles } from "@/components/role-entry"
import { ContactSection } from "@/components/contact-section"
import { MotionScope } from "@/components/motion/motion-scope"
import { HeroScope } from "@/components/motion/hero-scope"
/* NO `BandTone` IMPORT ON THIS PAGE, and its absence is deliberate rather than an
   oversight. Each band used to render one, a faint gold radial centred on that
   band, and the home page is the one route where four of them stack directly
   above one another: that is what produced four bright middles and four seams
   instead of one continuous surface. This page paints `.hero-field` behind the
   whole of `<main>` instead. The component is unchanged and still correct for the
   sub-pages, which open with a `.page-hero` and carry no continuous field. */
/* The working-together section's pinned two-column grid. Owns the <ul> and the
   <li> wrapper for each row it is passed; see the header note in the component
   for why this is a pinned ledger and not the 3D card deck first planned. */
import { PinnedLedger } from "@/components/motion/fm/pinned-ledger"
/* Dev-only invariant checks on the rendered tree. Null in production. */
import { MotionAudit } from "@/components/motion/fm/audit"
import {
  ExpertiseLattice,
  PositionsThread,
  ContactArcs,
} from "@/components/motion/objects"
import {
  getIdentity,
  getHeadline,
  getExpertise,
  getBiography,
  getPositions,
  getAwards,
  getNavigation,
  getSectionAvailability,
  localizeName,
} from "@/lib/profile-content"
import { getPublicContact, getSiteSettings, getDeliverables } from "@/lib/site-settings"
import { getMedia } from "@/lib/media"
import { isSignedOff, publishable } from "@/lib/verification"
import { localize } from "@/lib/localize"
import { resolveNavItems, localePrefix } from "@/lib/nav"
import { buildMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return buildMetadata(locale)
}

/**
 * The one-page profile, the Kyros `index.html` structure, section for section:
 *
 *   hero → about (+ quote) → expertise → positions → (memberships) →
 *   (press) → contact → footer
 *
 * The bracketed sections are conditional. Press stays off, because intake section
 * 4 records media coverage as "غير مطلوب حاليًا".
 *
 * THE QUOTE IS NO LONGER ITS OWN BAND. The philosophy paragraph in her supplied
 * profile is first-person and attributable, so it renders for this subject, but
 * it now sits under her portrait inside the about block rather than as a
 * full-bleed strip below it. `components/quote.tsx` is still the component for a
 * standalone pull quote and is untouched; this page simply no longer needs one.
 *
 * That gating is the whole editorial argument of this build. A profile whose
 * credibility is the product cannot carry a counter nobody has verified, or a
 * blockquote she never gave. `getSectionAvailability()` decides, from the data
 * alone, which sections have earned their place, so the page grows as the open
 * questions are answered, and never before.
 *
 * The awards band became memberships when the subject changed: intake section 3
 * marks الإنجازات والجوائز غير متوفرة and checks العضويات والشراكات instead.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [
    identity,
    headline,
    expertise,
    bio,
    positions,
    { memberships },
    navigation,
    availability,
    contact,
    settings,
    deliverables,
    heroBackground,
    portrait, organisationLogo] = await Promise.all([
    getIdentity(),
    getHeadline(),
    getExpertise(),
    getBiography(),
    getPositions(),
    getAwards(),
    getNavigation(),
    getSectionAvailability(locale),
    getPublicContact(),
    getSiteSettings(),
    getDeliverables(),
    // hero-background is null, intake section 5 asks for a horizontal image at
    // 1920px or wider and neither supplied file reaches it. The portrait IS wired:
    // both photographs arrived with the form and carry a recorded permission.
    getMedia("hero-background", locale),
    getMedia("portrait", locale),
    // The IBC mark. Resolves to null while the slot has no recorded permission,
    // which is the state it ships in, so the hero's affiliation block is simply
    // absent rather than empty. Opening the slot in data/media.json is the only
    // change needed to make it appear.
    getMedia("logo-ibc", locale),
  ])

  const t = await getTranslations()
  const signedOff = isSignedOff(deliverables.signOff)

  /*
   * The hero stat figures.
   *
   * COUNTED THROUGH `publishable()`, NOT `.length`. A row marked tier C or
   * `publish: false` is withheld from the lists further down the page, so counting
   * the raw arrays would advertise a number the visitor cannot then find, and
   * would quietly present unverified records as verified ones.
   *
   * StatBar drops any cell whose value is empty or "0", and any `kind: "count"`
   * cell below 2, so nothing here needs a guard: if every position were withheld,
   * or only one publishes, the bar simply loses that cell.
   *
   * WITH THE EXPERIENCE CELL REMOVED (see below) THIS ARRAY IS ONE ENTRY, and
   * that entry is a `count` currently resolving to 1, so both the bar and the
   * hero meta row drop it and render nothing from `stats` today. That is the
   * suppression rules working as written rather than a hole: the moment a second
   * position publishes, the cell returns on its own.
   */
  const prefix = localePrefix(locale)
  /*
   * THE EXPERIENCE FIGURE IS REMOVED FROM DISPLAY, at the client's request.
   *
   * It was the first cell here and it fed the hero meta row (components/hero.tsx
   * assembles that row from `stats`). `data/identity.json` still holds
   * `yearsOfExperience`, and /admin/identity still edits it, so nothing is lost
   * from the record; it simply no longer renders.
   *
   * Open question Q8 in data/deliverables.json is what made it worth removing
   * rather than correcting: the supplied biography says "close to ten years"
   * while the profile figure says "10+", and the two cannot both be right. A
   * number in a stat row reads as verified, so the unverifiable one is the wrong
   * thing to keep on the page while the question is open. Restoring it is putting
   * this entry back once Q8 is answered.
   */
  const stats = [
    {
      value: String(publishable(positions.current ?? []).length),
      label: t("hero.statPositions"),
      kind: "count" as const,
    },
  ]

  // One entry per organisation. See components/role-entry.tsx: the position and
  // the membership records describe the same body for this subject.
  const roles = composeRoles(positions.current, memberships)

  /*
   * The "working together" cards.
   *
   * DRAWN FROM HER OWN EXPERTISE ITEMS, NOT WRITTEN. Each card is one of the
   * `expertise.items` phrases she supplied at intake, so the section introduces no
   * claim the site does not already make, it only reframes the list as things a
   * visitor can enquire about, which is what intake section 2 asks the site to do.
   *
   * Four rather than all eight: the section is an invitation, not a second
   * capabilities list, and the full set already has its own page.
   */
  const engagements = (expertise.items ?? [])
    .slice(0, 4)
    .map((item: { id: string; title: Parameters<typeof localize>[0] }) => ({
      id: item.id,
      label: localize(item.title, locale),
    }))
    .filter((e: { label: string }) => e.label)

  const facts = [
    // The experience row is removed here for the same reason it is removed from
    // `stats` above; see that note. The field survives in data/identity.json.
    { label: t("about.sectorLabel"), value: localize(identity.sector, locale) },
    { label: t("about.baseLabel"), value: localize(identity.residence, locale) },
    { label: t("about.marketsLabel"), value: localize(identity.otherMarkets, locale) },
    { label: t("about.nationalityLabel"), value: localize(identity.nationality, locale) },
    // careerStartYear is empty on the intake form, so no row is produced for it.
    // Filtering below rather than conditionally pushing keeps the list declarative.
  ].filter((f) => f.value)

  return (
    <>
      <SiteNav
        items={resolveNavItems(navigation.main ?? [], locale)}
        name={localizeName(identity, locale)}
        contactHref={`${prefix}/contact`}
      />

      {/*
        `main-field` establishes the stacking context for the continuous hero
        field below it; see the block at the end of styles/globals.css for why the
        atmosphere is ONE fixed layer here rather than a copy inside each band.
      */}
      <main id="main" className="main-field">
        {/*
          THE HERO ATMOSPHERE, EXTENDED OVER THE WHOLE PAGE.

          Every band below the hero used to paint its own `<BandTone />`, a faint
          gold radial centred on that band, which is what made the page read as a
          lit hero followed by four separately-lit boxes. Four centred radials
          stacked vertically produce four bright middles and four dark seams; the
          bands were tinted the same colour and still did not look like one
          surface, because the gradient restarted at every boundary.

          One fixed field removes the restarts. It is mounted here rather than in
          the layout because it belongs to this page's composition, the sub-pages
          open with `.page-hero` and keep the hero's own `.mesh-hero` markup.
        */}
        <div aria-hidden className="hero-field" />

        {/*
          THE CONNECTED THREAD WAS REMOVED FROM DISPLAY.

          `<SectionThread targetId="main" />` stood here: one SVG measured across
          every band, drawing itself on scroll and carrying a travelling spark.
          Removed at the client's request as too decorative for a formal
          consultant profile.

          IT WAS ALSO A SECOND READOUT OF THE FIRST. `<ReadingRail />` in
          app/[locale]/layout.tsx already reports document progress, and two
          elements answering "how far down am I" is one more than the question
          has. The rail is the one that stayed, because it is a 2px hairline at
          the viewport edge rather than a lit curve through the content column.

          components/motion/fm/section-thread.tsx and its `.section-thread` rules
          in styles/globals.css are left in place, unmounted. Restoring it is the
          import plus this line; the component carries a long note on why the
          geometry is measured rather than hardcoded, which is worth keeping
          whether or not it renders.
        */}


        {/*
          The hero is wrapped rather than carrying its own scope, because it is a
          SERVER component and must stay one, it does no data fetching of its own
          but it renders `localize` output for three locales, and making it a
          client component would ship that work to the browser for nothing.
          MotionScope takes the already-rendered markup as children and animates it
          from the outside, which is the same arrangement every dedicated page uses.

          `HeroScope` replaces the bare `MotionScope` that stood here. It mounts the
          hero's own motion, the staggered entrance, the one-pass shimmer on the
          name, the role crossfade and the pointer parallax, all of which fire on
          LOAD and none of which observe the scroll position. See
          components/motion/hero.ts for why that distinction is the whole design.
        */}
        <HeroScope>
          <Hero
            kicker={headline.heroKicker}
            name={localizeName(identity, locale)}
            roles={headline.rotatingRoles?.[locale] ?? headline.rotatingRoles?.en ?? []}
            title={headline.primaryTitle}
            locations={headline.locations ?? []}
            statement={headline.heroStatement ?? null}
            // Empty by design, intake section 9 records every account as
            // "لم يُزوَّد", so SocialRow renders decorative rings, not dead links.
            social={settings.social ?? []}
            stats={stats}
            contactHref={`${prefix}/contact`}
            aboutHref={`${prefix}/about`}
            background={heroBackground}
            // The same cleared slot AboutSection uses. The hero's round frame was
            // reading `heroBackground`, which is permanently empty, so it could
            // never have shown a photograph.
            portrait={portrait}
            organisationLogo={organisationLogo}
          />
        </HeroScope>

        {/*
          `snap-section` makes each band one viewport tall and a scroll-snap
          target. It is min-height rather than height (see styles/globals.css), so
          a section whose content outgrows the viewport, which the positions list
          does in Turkish and Arabic, simply becomes taller instead of clipping.

          The object layer is rendered as a SIBLING of the content and behind it,
          never as a wrapper: it is aria-hidden decoration, and nesting content
          inside it would put the whole section behind aria-hidden.
        */}
        {/* No background object on this one: AboutSection already renders the
            drifting rings inside its portrait frame, and a second copy behind the
            text would read as the same shape printed twice. */}
        <MotionScope
          as="section"
          id="section-about"
          interaction="hoverRule"
          recipe="aboutSpread"
          physics
          className="section-skew snap-section section-pad"
        >
          <div className="section-content container-page">
            <SectionHeader title={t("about.heading")} animate maskReveal />
            {/*
              The quote is passed INTO the about section rather than rendered as
              its own band below it. It used to be a full-bleed `Quote` strip a
              screen further down; set beside her portrait it reads as her saying
              it, which is what a first-person statement of principle is for.

              `availability.quote` still decides. The gate has not moved, only
              where the line is set, so a subject who supplies no attributable
              quote still gets no blockquote and no attribution, exactly as before.
            */}
            <AboutSection
              bio={bio.shortBio}
              facts={facts}
              portrait={portrait}
              quote={availability.quote ? bio.quote : undefined}
              quoteAttribution={bio.quoteAttribution}
            />
          </div>
        </MotionScope>

        <MotionScope
          as="section"
          id="section-expertise"
          recipe="markWall"
          physics
          /*
            NO `bg-[color:var(--surface)]` HERE ANY MORE. This was the one band
            that painted an opaque ground a step lighter than the page, which is
            the seam the continuous field exists to remove: an opaque fill covers
            `.hero-field` outright, so the band would have stayed a visible box no
            matter what was lit behind it. Its separation now comes from the
            field's own falloff and from `.band-edge`, the same as every other
            dark band on the page.
          */
          className="section-skew snap-section section-pad"
        >
          <ExpertiseLattice />
          <div className="section-content container-page">
            <SectionHeader title={t("expertise.heading")} subtitle={t("expertise.subheading")} animate maskReveal />
            <ExpertiseGrid items={expertise.items ?? []} />
          </div>
        </MotionScope>

        {/*
          THE TWO-COLUMN SPLIT, the main structural break in the page's rhythm.

          Every section here used to be the same shape: a centred heading, a rule,
          then full-width content. Seven of those stacked is the uniform vertical
          cadence that makes a page read as generated, because the layout never
          responds to what any given section contains.

          Positions and Recognition are LISTS, chronological rows of organisation
          names and dates. Setting the heading in a narrow left column with the list
          beside it does three things a stacked heading cannot: the heading stays
          visible next to the rows it labels while they are read, the list starts at
          the same optical line on every section, and the page finally has a second
          layout shape.

          `lg:sticky` on the heading column, so on a long list the label holds
          position as the rows scroll past it. `items-start` on the grid is what
          allows that, a stretched grid item has no free space to stick within.

          It collapses to a single column below `lg`, where there is no room for a
          side column and the stacked order (heading, then list) is the correct
          reading order anyway.
        */}
        {/*
          ONE BAND FOR BOTH. Positions and Memberships were two sections here, and
          for this subject both listed the same organisation, the post she holds
          and the body she is affiliated with are one relationship, so the page
          named the International Business Council twice under two headings.

          `composeRoles()` folds them by organisation name; see
          components/role-entry.tsx for why the merge happens at render rather
          than in the data.

          THE LIGHT BAND IS GONE. This section carried `.section-invert`, which
          re-points the palette tokens for its subtree (styles/globals.css) so
          every component inside it painted itself on a near-white ground.

          It is removed on request: the page is black end to end, and one
          near-white band in the middle of it was the single largest departure
          from that. The class and all of its dependent rules survive untouched in
          the stylesheet, so restoring the band is putting one class name back
          here, nothing else has to be rebuilt.
        */}
        {roles.length > 0 && (
          <MotionScope
            as="section"
            id="section-roles"
            interaction={["ledgerMarks", "verifyMarks"]}
            recipe="ledgerRows"
            className="snap-section section-pad"
          >
            <PositionsThread />
            <div className="section-content container-page grid items-start gap-y-8 lg:grid-cols-[minmax(0,16rem)_1fr] lg:gap-x-20">
              <div className="lg:sticky lg:top-32">
                <SectionHeader title={t("pages.roles.currentHeading")} animate maskReveal />
              </div>
              <RoleEntryList roles={roles} />
            </div>
          </MotionScope>
        )}

        {/*
          WORKING TOGETHER, the section intake form section 2 implies and the site
          did not have.

          Its stated goal is "استقطاب فرص وشراكات" and the single most important
          visitor action is "تعبئة نموذج تواصل لاستفسارات الأعمال والشراكات". The
          page listed her capabilities and then, several screens later, offered a
          form; nothing connected the two.

          Every card is one of her own `expertise.items`, no new claim is made,
          and there is no outcome, volume or client named anywhere in it (section 3
          forbids all three). It names KINDS OF WORK, and each one prefills the
          enquiry form with its own subject via the existing `prefillEnquiry`
          interaction.
        */}
        {/*
          AN EDITORIAL SPLIT, NOT A CARD GRID.

          The four cards this replaced were ~90% empty space, and the reason is in
          the data rather than the styling: `expertise.items` carries `id`, `icon`
          and `title` only (data/expertise.json), there is no description field, so
          a card sized for a heading-plus-paragraph had only ever one short phrase
          to put in it. Fitting the container to the content is the fix; writing
          four descriptions into the CMS would have been the alternative.

          The left column also does something the grid could not: it SAYS WHAT
          CLICKING DOES. "Start an enquiry" printed four times spent the words
          without ever explaining that the button prefills the form below, so the
          lede now carries that once and each row is left as a plain subject.

          `recipe="aboutSpread"` rather than `panelGrid`: that recipe already
          animates a `bio` block and staggered `row`s, which is exactly this
          composition, the left column is the bio, each engagement is a row. No new
          recipe was needed.
        */}
        <MotionScope
          as="section"
          id="section-working-together"
          interaction="prefillEnquiry"
          recipe="aboutSpread"
          physics
          className="section-skew snap-section section-pad"
        >
          <div className="section-content container-page">
            {/*
              `PinnedLedger` owns the two-column grid so it can pin the left
              column and drive the rows. It takes the statement and the rows as
              separate props because they are laid out independently, see
              components/motion/fm/pinned-ledger.tsx, which also records why this
              is a pinned ledger rather than the 3D card deck the plan first
              described (the markup it was written against no longer exists).

              Below `md`, and under reduced motion, it renders exactly the plain
              grid and list that were here before.
            */}
            <PinnedLedger
              className="grid gap-x-16 gap-y-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:items-start"
              statement={
                /*
                  `data-anime="bio"`, the recipe fades and lifts this whole column
                  as one object. Its children are deliberately NOT hooked
                  individually: a heading, an eyebrow and a lede arriving separately
                  reads as three things queueing, when they are one statement.
                */
                <div data-anime="bio">
                  <span className="eyebrow block">{t("pages.workingTogether.heading")}</span>
                  <h2 className="mt-3 font-display text-[clamp(1.6rem,3vw,2.1rem)] font-normal leading-[1.15] text-balance text-[color:var(--heading)]">
                    {t("pages.workingTogether.splitHeading")}
                  </h2>
                  <p className="mt-5 max-w-[34ch] text-sm leading-[1.75] text-[color:var(--foreground)]">
                    {t("pages.workingTogether.splitLede")}
                  </p>
                </div>
              }
            >
              {/*
                One hairline between rows rather than four bordered boxes. These
                are four peer subjects with no order, the same reason
                components/expertise-grid.tsx dropped its numerals. The <ul> and
                each <li> are rendered by the wrapper; everything inside the row,
                including the prefill hooks `prefillEnquiry` binds to, is
                server-rendered here and passed through untouched.
              */}
              {engagements.map((e: { id: string; label: string }) => (
                <div key={e.id} data-anime="row" className="engagement-rule">
                  <button
                    type="button"
                    data-interact="prefill"
                    data-prefill-value={e.label}
                    className="engagement-row flex w-full items-baseline justify-between gap-6 px-1 py-5 text-start"
                  >
                    <span className="text-[0.95rem] leading-snug text-[color:var(--heading)]">
                      {e.label}
                    </span>
                    {/*
                      The CTA is per-row for screen readers, "Business
                      development, Enquire" is a complete label, but is revealed
                      on hover/focus for the eye, so the resting column stays a
                      clean list of subjects rather than four repetitions of the
                      same word. `.engagement-cta` handles that in CSS; it is
                      never display:none, so it is always announced.
                    */}
                    <span className="engagement-cta eyebrow shrink-0 text-[color:var(--primary-strong)]">
                      {t("pages.workingTogether.cta")}
                      <span aria-hidden className="engagement-arrow ms-2 inline-block">
                        &rarr;
                      </span>
                    </span>
                  </button>
                </div>
              ))}
            </PinnedLedger>
          </div>
        </MotionScope>

        <MotionScope
          as="section"
          id="section-contact"
          interaction="copyEmail"
          recipe="proseArrival"
          physics
          className="section-skew snap-section section-pad"
        >
          <ContactArcs />
          <div className="section-content container-page">
            <SectionHeader title={t("contact.heading")} subtitle={t("contact.subheading")} animate maskReveal />
            <ContactSection
              emails={contact.emails}
              phones={contact.phones}
              addresses={contact.addresses}
              cityOnly={contact.cityOnly}
              showForm={settings.visibility?.contactForm !== false}
            />
          </div>
        </MotionScope>
      </main>

      {/*
        Development-only assertions about the composed DOM: that no element is
        claimed by both motion layers, that the subject's name is still one intact
        text node, and that no heading is left masked. Renders null and is
        dead-code-eliminated in production, see components/motion/fm/audit.tsx.
      */}
      <MotionAudit />

      <SiteFooter />
    </>
  )
}
