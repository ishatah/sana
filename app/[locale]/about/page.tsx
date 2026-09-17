import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { PageShell } from "@/components/page-shell"
import { PageHero } from "@/components/page-hero"
import { MotionScope } from "@/components/motion/motion-scope"
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
 * frame are identical to the home page, one component, one set of rules.
 *
 * The focus section is this page's own contribution. `headline.positioning` is
 * real supplied data (intake section 9) that renders nowhere else on the site, so
 * surfacing it here adds substance without adding a claim.
 *
 * The full biography RENDERS for this subject, she supplied it in both languages
 * at intake, and is split into its four paragraphs here rather than run together.
 *
 * The career-journey section below it is the one that is still blocked: the stages
 * are known but the dates are not (intake section 4), so it names the gap instead
 * of inventing an ordering. Both behaviours come from the same gate; neither needs
 * a flag flipped when the data arrives.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [identity, headline, bio, availability, portrait] = await Promise.all([
    getIdentity(),
    getHeadline(),
    getBiography(),
    getSectionAvailability(locale),
    getMedia("portrait", locale),
  ])

  const t = await getTranslations()

  const facts = [
    /*
     * THE EXPERIENCE ROW IS REMOVED FROM DISPLAY, at the client's request, the
     * same removal the home page makes in app/[locale]/page.tsx; see the longer
     * note there. `identity.yearsOfExperience` is untouched in the data and still
     * editable at /admin/identity, so this is a display decision rather than a
     * deletion, and open question Q8 (the biography says "close to ten years"
     * against the profile's "10+") stays open and answerable.
     */
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
      <MotionScope
        as="section"
        id="about-profile" recipe="aboutSpread"
        interaction="hoverRule"
        physics
        className="section-skew snap-section page-section"
      >
        <div className="container-page">
          <SectionHeader animate title={t("pages.about.profileHeading")} />
          {/* Same pairing as the home page, the quote belongs to the portrait, and
              the two pages share one component precisely so they cannot drift. */}
          <AboutSection
            bio={bio.shortBio}
            facts={facts}
            portrait={portrait}
            quote={availability.quote ? bio.quote : undefined}
            quoteAttribution={bio.quoteAttribution}
          />
        </div>
      </MotionScope>

      {/*
        NO `interaction` PROP ON THE SECTION BELOW. It carried `magneticCards`,
        which leaned each panel toward the cursor, removed from interactions.ts
        along with the `.panel-3d:hover` lift it built on, because these panels are
        not interactive and the effect required `tabIndex={0}` on a static <div> to
        be keyboard-reachable at all.

        The `panelCascade` scroll reveal that used to run here went with the rest of
        the page's scroll motion. The `data-anime="panel"` hooks below are left in
        place: they cost nothing, and they are what a future entrance animation,
        or a future interaction, would select on.
      */}
      {focus.length > 0 && (
        <MotionScope
          as="section"
          id="about-focus" recipe="panelGrid"
          physics
          className="section-skew snap-section page-section page-section-alt"
        >
          <div className="container-page">
            <SectionHeader animate title={t("pages.about.focusHeading")} />
            <dl className="depth-stage grid max-w-3xl gap-8 sm:grid-cols-3">
              {focus.map((f) => (
                <div key={f.label} data-anime="panel" className="panel-wipe card-ruled panel-3d p-6">
                  {/* `.eyebrow` rather than a hand-rolled uppercase utility, so this
                      label matches every other piece of metadata on the site,
                      including the reduced tracking and the Turkish casing rule. */}
                  <dt className="eyebrow mb-2">{f.label}</dt>
                  <dd className="text-sm leading-relaxed text-[color:var(--card-foreground)]">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </MotionScope>
      )}

      <MotionScope as="section" id="about-full" recipe="proseArrival" physics className="section-skew snap-section page-section">
        <div className="container-page">
          <SectionHeader animate title={t("pages.about.fullBioHeading")} />
          {availability.fullBio ? (
            /*
             * SPLIT ON THE BLANK LINE. The whole biography used to render inside a
             * single <p>, so all four paragraphs of it ran together as one wall of
             * text, the `

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
      </MotionScope>

    </PageShell>
  )
}
