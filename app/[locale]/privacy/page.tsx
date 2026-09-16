import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { LegalPage, LegalHeading } from "@/components/legal/legal-page"
import { getPublicContact } from "@/lib/site-settings"
import { localize } from "@/lib/localize"
import { buildMetadata } from "@/lib/seo"

const UPDATED = "2026-09-10"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "legal" })
  return buildMetadata(locale, { title: t("privacy"), path: "/privacy" })
}

/**
 * Privacy notice.
 *
 * Scoped to what this site actually does, which is very little: it has no
 * analytics, no advertising, no third-party embeds, and the only personal data it
 * ever receives is what someone types into the contact form. Saying that plainly
 * is more useful, and more accurate, than a generic template describing cookie
 * categories and processors that do not exist here.
 *
 * The contact address is read from settings rather than hardcoded, so it can never
 * name an address the contact page is withholding.
 */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("legal")
  const contact = await getPublicContact()
  const email = contact.primaryEmail?.address

  const copy = {
    en: {
      intro: "This notice explains what personal data this website collects and how it is used.",
      collectHeading: "What is collected",
      collect:
        "This site receives only what you type into the contact form: your name, your email address, optionally your organisation, and your message. There are no analytics, no advertising trackers, and no third-party embeds on the site.",
      useHeading: "How it is used",
      use: "It is used solely to reply to your message. It is not used for marketing, and it is not sold or shared.",
      cookiesHeading: "Cookies",
      cookies:
        "No cookies are set on the public pages of this site. A single session cookie is created only when signing in to the administration panel, which does not concern visitors.",
      rightsHeading: "Your rights",
      rights:
        "You may request a copy of the message you sent, or ask for it to be deleted. Write to the address below.",
      contactHeading: "Contact",
    },
    ar: {
      intro: "يوضح هذا الإشعار البيانات الشخصية التي يجمعها هذا الموقع وكيفية استخدامها.",
      collectHeading: "البيانات التي تُجمع",
      collect:
        "لا يتلقى هذا الموقع سوى ما تكتبه في نموذج الاتصال: الاسم، والبريد الإلكتروني، والجهة اختياريًا، والرسالة. لا توجد أدوات تحليل أو تتبع إعلاني أو محتوى مضمَّن من طرف ثالث.",
      useHeading: "أوجه الاستخدام",
      use: "تُستخدم هذه البيانات للرد على رسالتك فقط. ولا تُستخدم للتسويق ولا تُباع ولا تُشارَك.",
      cookiesHeading: "ملفات الارتباط",
      cookies:
        "لا تُستخدم ملفات ارتباط في الصفحات العامة لهذا الموقع. يُنشأ ملف ارتباط واحد للجلسة عند تسجيل الدخول إلى لوحة الإدارة فقط، وهو لا يخص الزوار.",
      rightsHeading: "حقوقك",
      rights: "يمكنك طلب نسخة من الرسالة التي أرسلتها أو طلب حذفها بالكتابة إلى العنوان أدناه.",
      contactHeading: "الاتصال",
    },
    /*
     * DUTCH USES AVG TERMINOLOGY, NOT TRANSLATED-ENGLISH GDPR TERMINOLOGY.
     *
     * "de AVG" (Algemene verordening gegevensbescherming) is what the regulation
     * is called in Dutch; a privacy page that says "GDPR" to a Dutch reader reads
     * as translated from English. Likewise "persoonsgegevens" rather than
     * "persoonlijke data", and cookies are "geplaatst" rather than "ingesteld",
     * which is the settled Dutch idiom.
     *
     * THE SUBSTANCE IS IDENTICAL TO THE ENGLISH AND MUST STAY THAT WAY. Every
     * sentence here is a factual claim about this specific site, no analytics, no
     * advertising trackers, no third-party embeds, one admin session cookie. These
     * are verifiable statements, not marketing copy, so a translation is only
     * correct if it asserts exactly the same set of facts. Rewording for flow is
     * fine; changing what is claimed is not.
     */
    nl: {
      /*
       * THE AVG IS NAMED HERE AND NOWHERE IN THE ENGLISH, AND THAT IS NOT A DRIFT.
       *
       * The English intro names no regulation, so a literal translation would name
       * none either. A Dutch privacy notice that never says which law it is written
       * under reads as a translated foreign document, and "de AVG" is how a Dutch
       * reader identifies that law, so the reference is added rather than carried over.
       *
       * It adds no CLAIM the English does not make: naming the regulation the notice
       * already operates under is a pointer, not a new fact about what is collected or
       * how it is used. Every factual sentence below still matches the English exactly,
       * which is the constraint that matters. If the English intro ever names the GDPR
       * itself, collapse the two back together.
       */
      intro:
        "In deze verklaring staat welke persoonsgegevens deze website verzamelt en hoe die worden gebruikt, zoals bedoeld in de Algemene verordening gegevensbescherming (AVG).",
      collectHeading: "Welke gegevens worden verzameld",
      collect:
        "Deze site ontvangt uitsluitend wat u zelf in het contactformulier invult: uw naam, uw e-mailadres, optioneel uw organisatie, en uw bericht. Er is geen statistieksoftware, er zijn geen advertentietrackers en er is geen ingesloten inhoud van derden op de site.",
      useHeading: "Waarvoor ze worden gebruikt",
      use: "Ze worden uitsluitend gebruikt om uw bericht te beantwoorden. Ze worden niet gebruikt voor marketing en ze worden niet verkocht of gedeeld.",
      cookiesHeading: "Cookies",
      cookies:
        "Op de openbare pagina's van deze website worden geen cookies geplaatst. Er wordt één sessiecookie aangemaakt bij het inloggen op het beheerpaneel; die betreft bezoekers niet.",
      rightsHeading: "Uw rechten",
      rights:
        "U hebt recht op inzage in het bericht dat u hebt verstuurd en u kunt verzoeken om verwijdering daarvan. Schrijf daarvoor naar het onderstaande adres.",
      contactHeading: "Contact",
    },
  }[locale as "en" | "ar" | "nl"] ?? {
    intro: "",
    collectHeading: "",
    collect: "",
    useHeading: "",
    use: "",
    cookiesHeading: "",
    cookies: "",
    rightsHeading: "",
    rights: "",
    contactHeading: "",
  }

  return (
    <LegalPage title={t("privacy")} updated={UPDATED}>
      <p>{copy.intro}</p>

      <LegalHeading>{copy.collectHeading}</LegalHeading>
      <p>{copy.collect}</p>

      <LegalHeading>{copy.useHeading}</LegalHeading>
      <p>{copy.use}</p>

      <LegalHeading>{copy.cookiesHeading}</LegalHeading>
      <p>{copy.cookies}</p>

      <LegalHeading>{copy.rightsHeading}</LegalHeading>
      <p>{copy.rights}</p>

      {email && (
        <>
          <LegalHeading>{copy.contactHeading}</LegalHeading>
          <p>
            <a href={`mailto:${email}`} className="text-[color:var(--primary-strong)] hover:underline">
              {email}
            </a>
          </p>
        </>
      )}
    </LegalPage>
  )
}
