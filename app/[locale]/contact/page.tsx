import type { Metadata } from "next"
import Link from "next/link"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { PageShell } from "@/components/page-shell"
import { PageHero } from "@/components/page-hero"
import { MotionScope } from "@/components/motion/motion-scope"
import { BandTone } from "@/components/motion/fm/band-tone"
import { SectionHeader } from "@/components/section-header"
import { ContactSection } from "@/components/contact-section"
import { CommitsGrid } from "@/components/ui/commits-grid"
import { getHeadline, getIdentity } from "@/lib/profile-content"
import { getPublicContact, getSiteSettings } from "@/lib/site-settings"
import { localize } from "@/lib/localize"
import { localePrefix } from "@/lib/nav"
import { buildMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return buildMetadata(locale, { title: t("contact"), path: "/contact" })
}

/**
 * The contact page.
 *
 * `ContactSection` is reused, so the visibility allowlist still governs what
 * appears: today that is the country and the form alone, intake section 6 defers
 * every email, phone and address until they are confirmed in writing (open
 * question Q3).
 *
 * The enquiries section splits `headline.positioning.audience`, supplied data
 * that renders nowhere else, into cards. Splitting on the comma is safe here
 * because the field is authored as a list in both locales, and the Arabic
 * uses the Arabic comma (U+060C), which is why both separators are handled.
 */
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [headline, contact, settings, identity] = await Promise.all([
    getHeadline(),
    getPublicContact(),
    getSiteSettings(),
    getIdentity(),
  ])
  const t = await getTranslations()

  /*
   * THE SIGN-OFF GRID SPELLS THE LATIN GIVEN NAME IN BOTH LOCALES, ON PURPOSE.
   *
   * `CommitsGrid` has letterforms for A-Z, 0-9 and Ñ only, it silently drops
   * every character it cannot draw, so `nameArabic` would render as an empty
   * grid on /ar rather than as a transliteration. The mark therefore reads
   * "SANAE" on both locales, which is defensible because it IS her name in the
   * approved Latin spelling (intake section 6), not an English substitute for an
   * Arabic one.
   *
   * Taken from `nameLatin` rather than written as a literal so it follows the CMS
   *, the first token only, because a full "SANAE RAKIK" is eleven cells wide per
   * letter and would be a 67-column grid, illegible at any phone width.
   */
  const signatureMark = (identity.nameLatin ?? "").trim().split(/\s+/)[0] ?? ""

  // Split on both the Latin and the Arabic comma, the Arabic copy uses U+060C,
  // and splitting on "," alone would return the whole string as a single card.
  const audience = localize(headline.positioning?.audience, locale)
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow={t("pages.contact.eyebrow")}
          title={t("contact.heading")}
          lede={t("pages.contact.lede")}
        />
      }
    >
      {/*
        `copyEmail` and the form's field states both live in this section, but a
        scope takes one interaction. The form is the larger of the two and is
        wrapped separately below, so this one carries the copy buttons.
      */}
      <MotionScope
        as="section"
        id="contact-details" recipe="proseArrival"
        interaction="copyEmail"
        physics
        className="section-skew snap-section page-section"
      >
        <BandTone />
        <div className="container-page">
          <SectionHeader animate title={t("pages.contact.detailsHeading")} subtitle={t("contact.subheading")} />
          <ContactSection
            emails={contact.emails}
            phones={contact.phones}
            addresses={contact.addresses}
            cityOnly={contact.cityOnly}
            showForm={settings.visibility?.contactForm !== false}
          />
        </div>
      </MotionScope>

      {audience.length > 0 && (
        <MotionScope
          as="section"
          id="contact-enquiries" recipe="panelGrid"
          interaction="prefillEnquiry"
          physics
          className="section-skew snap-section page-section page-section-alt"
        >
          <BandTone />
          <div className="container-page">
            <SectionHeader animate title={t("pages.contact.enquiriesHeading")} />
            <ul className="depth-stage mx-auto grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {audience.map((item) => (
                <li key={item} data-anime="panel">
                  {/*
                    A real <button>, not a div with a click handler: clicking it
                    prefills the form's subject and moves focus there, which is a
                    genuine action and needs Enter/Space and an announced role.

                    `w-full h-full text-start` keeps it looking exactly like the
                    static card it replaced, a button element, not a button
                    appearance.
                  */}
                  <button
                    type="button"
                    data-interact="prefill"
                    data-prefill-value={item}
                    className="panel-wipe card-ruled panel-3d h-full w-full p-6 text-start"
                  >
                    <span className="text-sm leading-relaxed text-[color:var(--card-foreground)]">{item}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </MotionScope>
      )}

      <MotionScope as="section" id="contact-response" recipe="proseArrival" physics className="section-skew snap-section page-section">
        <BandTone />
        <div className="container-page">
          <SectionHeader animate title={t("pages.contact.responseHeading")} />
          <div data-anime="prose" className="page-prose">
            <p>{t("pages.contact.responseNote")}</p>
            <p>
              {t("pages.contact.privacyNote")}{" "}
              <Link
                href={`${localePrefix(locale)}/privacy`}
                className="text-[color:var(--primary-strong)] hover:underline"
              >
                {t("legal.privacy")}
              </Link>
            </p>
          </div>

          {/*
            THE SIGN-OFF MARK. Decorative, and the last thing on the page before
            the footer, a signature at the foot of a letter, which is exactly the
            beat this section ends on.

            `dir="ltr"` is load-bearing: the grid is a fixed left-to-right
            letterform raster, and on /ar the RTL flow would mirror the column
            order and spell the name backwards. The wrapper opts this one subtree
            back into LTR without touching the Arabic prose above it.

            No `data-anime` hook and no MotionScope interaction, the grid brings
            its own entry animation in CSS, and the site's reduced-motion block
            already flattens `animate-*` for anyone who asked for less movement.
          */}
          {signatureMark && (
            <div dir="ltr" className="mt-16 flex justify-center">
              <CommitsGrid text={signatureMark} className="max-w-md opacity-80" />
            </div>
          )}
        </div>
      </MotionScope>
    </PageShell>
  )
}
