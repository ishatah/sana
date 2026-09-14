import type { Metadata } from "next"
import Link from "next/link"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { PageShell } from "@/components/page-shell"
import { PageHero } from "@/components/page-hero"
import { AnimeScope } from "@/components/motion/anime-scope"
import { SectionHeader } from "@/components/section-header"
import { ContactSection } from "@/components/contact-section"
import { getHeadline } from "@/lib/profile-content"
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
 * appears: today that is the country and the form alone — intake section 6 defers
 * every email, phone and address until they are confirmed in writing (open
 * question Q3).
 *
 * The enquiries section splits `headline.positioning.audience` — supplied data
 * that renders nowhere else — into cards. Splitting on the comma is safe here
 * because the field is authored as a list in both locales, and the Arabic
 * uses the Arabic comma (U+060C), which is why both separators are handled.
 */
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [headline, contact, settings] = await Promise.all([
    getHeadline(),
    getPublicContact(),
    getSiteSettings(),
  ])
  const t = await getTranslations()

  // Split on both the Latin and the Arabic comma — the Arabic copy uses U+060C,
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
      <AnimeScope
        as="section"
        id="contact-details"
        interaction="copyEmail"
        className="snap-section page-section"
      >
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
      </AnimeScope>

      {audience.length > 0 && (
        <AnimeScope
          as="section"
          id="contact-enquiries"
          interaction="prefillEnquiry"
          className="snap-section page-section page-section-alt"
        >
          <div className="container-page">
            <SectionHeader animate title={t("pages.contact.enquiriesHeading")} />
            <ul className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {audience.map((item) => (
                <li key={item} data-anime="panel">
                  {/*
                    A real <button>, not a div with a click handler: clicking it
                    prefills the form's subject and moves focus there, which is a
                    genuine action and needs Enter/Space and an announced role.

                    `w-full h-full text-start` keeps it looking exactly like the
                    static card it replaced — a button element, not a button
                    appearance.
                  */}
                  <button
                    type="button"
                    data-interact="prefill"
                    data-prefill-value={item}
                    className="card-ruled panel-3d h-full w-full p-6 text-start"
                  >
                    <span className="text-sm leading-relaxed text-[color:var(--card-foreground)]">{item}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </AnimeScope>
      )}

      <AnimeScope as="section" id="contact-response" className="snap-section page-section">
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
        </div>
      </AnimeScope>
    </PageShell>
  )
}
