import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { PageShell } from "@/components/page-shell"
import { PageHero } from "@/components/page-hero"
import { AnimeScope } from "@/components/motion/anime-scope"
import { SectionHeader } from "@/components/section-header"
import { AboutSection } from "@/components/about-section"
import { PendingNote } from "@/components/pending-note"
import { getIdentity, getHeadline, getBiography, getSectionAvailability } from "@/lib/profile-content"
import { getMedia } from "@/lib/media"
import { localize } from "@/lib/localize"
import { buildMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return buildMetadata(locale, { title: t("about"), path: "/about" })
}

/**
 * The about page.
 *
 * `AboutSection` is reused as-is, so the bio, the fact list and the portrait
 * frame are identical to the home page — one component, one set of rules.
 *
 * The focus section is this page's own contribution. `headline.positioning` is
 * real supplied data (intake section 9) that renders nowhere else on the site, so
 * surfacing it here adds substance without adding a claim.
 *
 * The full biography RENDERS for this subject — she supplied it in both languages
 * at intake — and is split into its four paragraphs here rather than run together.
 *
 * The career-journey section below it is the one that is still blocked: the stages
 * are known but the dates are not (intake section 4), so it names the gap instead
 * of inventing an ordering. Both behaviours come from the same gate; neither needs
 * a flag flipped when the data arrives.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  // getExpertise() was fetched here only to feed the languages table, which no
  // longer renders. The data itself is untouched in data/expertise.json.
  const [identity, headline, bio, availability, portrait] = await Promise.all([
    getIdentity(),
    getHeadline(),
    getBiography(),
    getSectionAvailability(locale),
    getMedia("portrait", locale),
  ])

  const t = await getTranslations()

  const facts = [
    // The figure is interpolated from data/identity.json rather than hardcoded in
    // the message catalogue — see the note in messages/en.json. This row and the
    // home page's stat bar therefore cannot drift apart.
    { label: t("about.experienceLabel"), value: t("about.experienceValue", { years: identity.yearsOfExperience }) },
    { label: t("about.sectorLabel"), value: localize(identity.sector, locale) },
    { label: t("about.baseLabel"), value: localize(identity.residence, locale) },
    { label: t("about.marketsLabel"), value: localize(identity.otherMarkets, locale) },
    { label: t("about.nationalityLabel"), value: localize(identity.nationality, locale) },
  ].filter((f) => f.value)

  const positioning = headline.positioning ?? {}
  const focus = [
    { label: t("pages.about.primaryIdentityLabel"), value: localize(positioning.primaryIdentity, locale) },
    { label: t("pages.about.secondaryIdentityLabel"), value: localize(positioning.secondaryIdentity, locale) },
    { label: t("pages.about.audienceLabel"), value: localize(positioning.audience, locale) },
  ].filter((f) => f.value)

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow={t("pages.about.eyebrow")}
          title={t("about.heading")}
          lede={localize(bio.aboutIntro, locale) || t("pages.about.lede")}
        />
      }
    >
      <AnimeScope
        as="section"
        id="about-profile"
        interaction="hoverRule"
        className="snap-section page-section"
      >
        <div className="container-page">
          <SectionHeader animate title={t("pages.about.profileHeading")} />
          {/* Same pairing as the home page — the quote belongs to the portrait, and
              the two pages share one component precisely so they cannot drift. */}
          <AboutSection
            bio={bio.shortBio}
            facts={facts}
            portrait={portrait}
            quote={availability.quote ? bio.quote : undefined}
            quoteAttribution={bio.quoteAttribution}
          />
        </div>
      </AnimeScope>

      {/*
        NO `interaction` PROP ON THE SECTION BELOW. It carried `magneticCards`,
        which leaned each panel toward the cursor — removed from interactions.ts
        along with the `.panel-3d:hover` lift it built on, because these panels are
        not interactive and the effect required `tabIndex={0}` on a static <div> to
        be keyboard-reachable at all.

        The `panelCascade` scroll reveal that used to run here went with the rest of
        the page's scroll motion. The `data-anime="panel"` hooks below are left in
        place: they cost nothing, and they are what a future entrance animation —
        or a future interaction — would select on.
      */}
      {focus.length > 0 && (
        <AnimeScope
          as="section"
          id="about-focus"
          className="snap-section page-section page-section-alt"
        >
          <div className="container-page">
            <SectionHeader animate title={t("pages.about.focusHeading")} />
            <dl className="grid max-w-3xl gap-8 sm:grid-cols-3">
              {focus.map((f) => (
                <div key={f.label} data-anime="panel" className="card-ruled panel-3d p-6">
                  {/* `.eyebrow` rather than a hand-rolled uppercase utility, so this
                      label matches every other piece of metadata on the site —
                      including the reduced tracking and the Turkish casing rule. */}
                  <dt className="eyebrow mb-2">{f.label}</dt>
                  <dd className="text-sm leading-relaxed text-[color:var(--card-foreground)]">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </AnimeScope>
      )}

      <AnimeScope as="section" id="about-full" className="snap-section page-section">
        <div className="container-page">
          <SectionHeader animate title={t("pages.about.fullBioHeading")} />
          {availability.fullBio ? (
            /*
             * SPLIT ON THE BLANK LINE. The whole biography used to render inside a
             * single <p>, so all four paragraphs of it ran together as one wall of
             * text — the `

` breaks in data/biography.json were simply dropped
             * by JSX, silently and without any error to notice.
             *
             * `.page-prose p + p` already carries the spacing rule, so the fix is
             * to produce the paragraphs the stylesheet has always been waiting for.
             */
            <div data-anime="prose" className="page-prose">
              {localize(bio.fullBio, locale)
                .split(/\n{2,}/)
                .map((para) => para.trim())
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
            </div>
          ) : (
            <div data-anime="prose" className="mx-auto max-w-2xl">
              <PendingNote>{t("draft.pendingSection")}</PendingNote>
            </div>
          )}
        </div>
      </AnimeScope>

      {/*
        السيرة والمسيرة — checked on intake section 3, and the one page in that list
        with no content behind it yet.

        Section 4 records the career timeline as "يحتاج ترتيب" with the stages named
        (ضيافة · عقارات · تطوير أعمال · مجلس الأعمال الدولي) but the dates "فلم
        تُعتمد بعد". The sequence could be inferred from her biography; the dates
        could not, and a timeline is a format that promises dates.

        So the heading exists and the gap is stated, rather than the section being
        quietly omitted or filled with an ordering nobody approved. It fills itself
        when open question q2 is answered — the same arrangement /roles uses for the
        partnerships block.
      */}
      <AnimeScope as="section" id="about-journey" className="snap-section page-section page-section-alt">
        <div className="container-page">
          <SectionHeader animate title={t("pages.about.journeyHeading")} />
          <div data-anime="prose" className="mx-auto max-w-2xl">
            <PendingNote>{t("draft.pendingSection")}</PendingNote>
          </div>
        </div>
      </AnimeScope>
    </PageShell>
  )
}
