import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { Hero } from "@/components/hero"
import { SectionHeader } from "@/components/section-header"
import { AboutSection } from "@/components/about-section"
import { ExpertiseGrid } from "@/components/expertise-grid"
import { RoleEntryList, composeRoles } from "@/components/role-entry"
import { ContactSection } from "@/components/contact-section"
import { AnimeScope } from "@/components/motion/anime-scope"
import { HeroScope } from "@/components/motion/hero-scope"
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
 * The one-page profile — the Kyros `index.html` structure, section for section:
 *
 *   hero → about (+ quote) → expertise → positions → (memberships) →
 *   (press) → contact → footer
 *
 * The bracketed sections are conditional. Press stays off, because intake section
 * 4 records media coverage as "غير مطلوب حاليًا".
 *
 * THE QUOTE IS NO LONGER ITS OWN BAND. The philosophy paragraph in her supplied
 * profile is first-person and attributable, so it renders for this subject — but
 * it now sits under her portrait inside the about block rather than as a
 * full-bleed strip below it. `components/quote.tsx` is still the component for a
 * standalone pull quote and is untouched; this page simply no longer needs one.
 *
 * That gating is the whole editorial argument of this build. A profile whose
 * credibility is the product cannot carry a counter nobody has verified, or a
 * blockquote she never gave. `getSectionAvailability()` decides, from the data
 * alone, which sections have earned their place — so the page grows as the open
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
    portrait,
  ] = await Promise.all([
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
    // hero-background is null — intake section 5 asks for a horizontal image at
    // 1920px or wider and neither supplied file reaches it. The portrait IS wired:
    // both photographs arrived with the form and carry a recorded permission.
    getMedia("hero-background", locale),
    getMedia("portrait", locale),
  ])

  const t = await getTranslations()
  const signedOff = isSignedOff(deliverables.signOff)

  /*
   * The hero stat figures.
   *
   * COUNTED THROUGH `publishable()`, NOT `.length`. A row marked tier C or
   * `publish: false` is withheld from the lists further down the page, so counting
   * the raw arrays would advertise a number the visitor cannot then find — and
   * would quietly present unverified records as verified ones.
   *
   * The experience figure comes from `identity.yearsOfExperience` — the DATA, not
   * a translation string. It was previously `t("about.experienceValue")`, which
   * hardcoded "10+ years" in messages/en.json and messages/ar.json and left the
   * data field unread: the one number on this page that looks like a verified
   * statistic was the only one bypassing the data layer the rest of the build is
   * organised around. The unit word stays in the message catalogue (it has to be
   * translated); the VALUE comes from data.
   *
   * StatBar drops any cell whose value is empty or "0", and any `kind: "count"`
   * cell below 2 — so nothing here needs a guard: if every position were withheld,
   * or only one publishes, the bar simply loses that cell.
   */
  const prefix = localePrefix(locale)
  const stats = [
    { value: t("about.experienceValue", { years: identity.yearsOfExperience }), label: t("hero.statExperience") },
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
   * claim the site does not already make — it only reframes the list as things a
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
    { label: t("about.experienceLabel"), value: t("about.experienceValue", { years: identity.yearsOfExperience }) },
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
        name={identity.nameShort}
        contactHref={`${prefix}/contact`}
      />

      <main id="main">
        {/*
          The hero is wrapped rather than carrying its own scope, because it is a
          SERVER component and must stay one — it does no data fetching of its own
          but it renders `localize` output for three locales, and making it a
          client component would ship that work to the browser for nothing.
          AnimeScope takes the already-rendered markup as children and animates it
          from the outside, which is the same arrangement every dedicated page uses.

          `HeroScope` replaces the bare `AnimeScope` that stood here. It mounts the
          hero's own motion — the staggered entrance, the one-pass shimmer on the
          name, the role crossfade and the pointer parallax — all of which fire on
          LOAD and none of which observe the scroll position. See
          components/motion/hero.ts for why that distinction is the whole design.
        */}
        <HeroScope>
          <Hero
            kicker={headline.heroKicker}
            name={identity.nameShort}
            roles={headline.rotatingRoles?.[locale] ?? headline.rotatingRoles?.en ?? []}
            title={headline.primaryTitle}
            locations={headline.locations ?? []}
            // Empty by design — intake section 9 records every account as
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
          />
        </HeroScope>

        {/*
          `snap-section` makes each band one viewport tall and a scroll-snap
          target. It is min-height rather than height (see styles/globals.css), so
          a section whose content outgrows the viewport — which the positions list
          does in Turkish and Arabic — simply becomes taller instead of clipping.

          The object layer is rendered as a SIBLING of the content and behind it,
          never as a wrapper: it is aria-hidden decoration, and nesting content
          inside it would put the whole section behind aria-hidden.
        */}
        {/* No background object on this one: AboutSection already renders the
            drifting rings inside its portrait frame, and a second copy behind the
            text would read as the same shape printed twice. */}
        <AnimeScope
          as="section"
          id="section-about"
          interaction="hoverRule"
          className="snap-section section-pad"
        >
          <div className="section-content container-page">
            <SectionHeader title={t("about.heading")} animate />
            {/*
              The quote is passed INTO the about section rather than rendered as
              its own band below it. It used to be a full-bleed `Quote` strip a
              screen further down; set beside her portrait it reads as her saying
              it, which is what a first-person statement of principle is for.

              `availability.quote` still decides. The gate has not moved — only
              where the line is set — so a subject who supplies no attributable
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
        </AnimeScope>

        <AnimeScope
          as="section"
          id="section-expertise"
          className="snap-section section-pad bg-[color:var(--surface)]"
        >
          <ExpertiseLattice />
          <div className="section-content container-page">
            <SectionHeader title={t("expertise.heading")} subtitle={t("expertise.subheading")} animate />
            <ExpertiseGrid items={expertise.items ?? []} />
          </div>
        </AnimeScope>

        {/*
          THE TWO-COLUMN SPLIT — the main structural break in the page's rhythm.

          Every section here used to be the same shape: a centred heading, a rule,
          then full-width content. Seven of those stacked is the uniform vertical
          cadence that makes a page read as generated, because the layout never
          responds to what any given section contains.

          Positions and Recognition are LISTS — chronological rows of organisation
          names and dates. Setting the heading in a narrow left column with the list
          beside it does three things a stacked heading cannot: the heading stays
          visible next to the rows it labels while they are read, the list starts at
          the same optical line on every section, and the page finally has a second
          layout shape.

          `lg:sticky` on the heading column, so on a long list the label holds
          position as the rows scroll past it. `items-start` on the grid is what
          allows that — a stretched grid item has no free space to stick within.

          It collapses to a single column below `lg`, where there is no room for a
          side column and the stacked order (heading, then list) is the correct
          reading order anyway.
        */}
        {/*
          ONE BAND FOR BOTH. Positions and Memberships were two sections here, and
          for this subject both listed the same organisation — the post she holds
          and the body she is affiliated with are one relationship, so the page
          named the International Business Council twice under two headings.

          `composeRoles()` folds them by organisation name; see
          components/role-entry.tsx for why the merge happens at render rather
          than in the data.

          THE ONE LIGHT BAND. `.section-invert` re-points the palette tokens for
          this subtree only (styles/globals.css), so every component inside it —
          the panels, the eyebrow, the rules — paints itself light with no
          per-component branch.
        */}
        {roles.length > 0 && (
          <AnimeScope
            as="section"
            id="section-roles"
            interaction="hoverRule"
            className="section-invert snap-section section-pad"
          >
            <PositionsThread />
            <div className="section-content container-page grid items-start gap-y-8 lg:grid-cols-[minmax(0,16rem)_1fr] lg:gap-x-20">
              <div className="lg:sticky lg:top-32">
                <SectionHeader title={t("pages.roles.currentHeading")} animate />
              </div>
              <RoleEntryList roles={roles} />
            </div>
          </AnimeScope>
        )}

        {/*
          WORKING TOGETHER — the section intake form section 2 implies and the site
          did not have.

          Its stated goal is "استقطاب فرص وشراكات" and the single most important
          visitor action is "تعبئة نموذج تواصل لاستفسارات الأعمال والشراكات". The
          page listed her capabilities and then, several screens later, offered a
          form; nothing connected the two.

          Every card is one of her own `expertise.items` — no new claim is made,
          and there is no outcome, volume or client named anywhere in it (section 3
          forbids all three). It names KINDS OF WORK, and each one prefills the
          enquiry form with its own subject via the existing `prefillEnquiry`
          interaction.
        */}
        <AnimeScope
          as="section"
          id="section-working-together"
          interaction="prefillEnquiry"
          className="snap-section section-pad"
        >
          <div className="section-content container-page">
            <SectionHeader
              title={t("pages.workingTogether.heading")}
              subtitle={t("pages.workingTogether.lede")}
              animate
            />
            <ul className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
              {engagements.map((e: { id: string; label: string }) => (
                <li key={e.id}>
                  <button
                    type="button"
                    data-interact="prefill"
                    data-prefill-value={e.label}
                    className="card-ruled panel-3d w-full p-6 text-start transition-colors"
                  >
                    <span className="block text-sm leading-relaxed text-[color:var(--card-foreground)]">
                      {e.label}
                    </span>
                    <span className="eyebrow mt-3 block text-[color:var(--primary-strong)]">
                      {t("pages.workingTogether.cta")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </AnimeScope>

        <AnimeScope
          as="section"
          id="section-contact"
          interaction="copyEmail"
          className="snap-section section-pad"
        >
          <ContactArcs />
          <div className="section-content container-page">
            <SectionHeader title={t("contact.heading")} subtitle={t("contact.subheading")} animate />
            <ContactSection
              emails={contact.emails}
              phones={contact.phones}
              addresses={contact.addresses}
              cityOnly={contact.cityOnly}
              showForm={settings.visibility?.contactForm !== false}
            />
          </div>
        </AnimeScope>
      </main>

      <SiteFooter />
    </>
  )
}
