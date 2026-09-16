import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { LegalPage, LegalHeading } from "@/components/legal/legal-page"
import { buildMetadata } from "@/lib/seo"

const UPDATED = "2026-09-14"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "legal" })
  return buildMetadata(locale, { title: t("terms"), path: "/terms" })
}

/**
 * Terms of use.
 *
 * Short by design. This is an informational profile, not a service, there is
 * nothing to buy, no account to hold, and no licence being granted to a visitor.
 *
 * THE NO-ADVICE CLAUSE IS THE LOAD-BEARING ONE HERE, and it is not boilerplate:
 * intake section 6 asks for it in as many words, "يُدرج تنبيه بأن محتوى الموقع
 * تعريفي بالمسيرة المهنية فقط، ولا يشكّل عرضًا استثماريًا أو استشارة مالية أو
 * قانونية". The subject works in business development, strategic partnerships and
 * real estate, and a profile describing that work could be read as soliciting
 * investment if nothing says otherwise. This is where it says otherwise.
 *
 * A third-party clause also stands, because the page names an organisation the
 * subject represents rather than owns. Naming it is not a claim that it endorses
 * this site.
 *
 * (The previous version of this file carried a clause about a foundation whose
 * name could be mistaken for a United Nations body. That organisation has no
 * connection to this subject and the clause is gone with it.)
 */
export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("legal")

  const copy = {
    en: {
      intro: "This website presents the professional profile of Sanae Rakik for informational purposes.",
      adviceHeading: "No offer or advice",
      advice:
        "The content of this website describes a professional career only. Nothing on it constitutes an investment offer, an invitation to invest, or financial or legal advice. No professional relationship is created by visiting this site or by sending a message through it.",
      accuracyHeading: "Accuracy of information",
      accuracy:
        "Roles and titles are published together with the full legal name of the organisation concerned. The information is correct at the date of publication; if you notice an error, please report it and it will be corrected.",
      thirdPartyHeading: "Third-party organisations",
      thirdParty:
        "Naming an organisation on this website does not mean that the organisation endorses this site. Where a representative or consulting role is described, it is described as such and does not imply ownership of the organisation named.",
      ipHeading: "Content rights",
      ip: "The text and design of this website are protected by copyright unless stated otherwise. Organisation logos remain the property of their respective owners.",
      linksHeading: "External links",
      links: "This website is not responsible for the content of external sites it links to.",
    },
    ar: {
      intro: "يعرض هذا الموقع الملف المهني لسناء رقيق لأغراض التعريف.",
      adviceHeading: "لا يشكّل عرضًا أو استشارة",
      advice:
        "محتوى هذا الموقع تعريفي بالمسيرة المهنية فقط، ولا يشكّل عرضًا استثماريًا أو دعوة للاستثمار أو استشارة مالية أو قانونية. ولا تنشأ أي علاقة مهنية بمجرد زيارة الموقع أو إرسال رسالة عبره.",
      accuracyHeading: "دقة المعلومات",
      accuracy:
        "تُنشر المناصب والألقاب مقرونة بالاسم القانوني الكامل للجهة المعنية. والمعلومات صحيحة بتاريخ النشر؛ وإذا لاحظت خطأً فيرجى الإبلاغ عنه ليُصحَّح.",
      thirdPartyHeading: "الجهات الخارجية",
      thirdParty:
        "ذكر اسم أي جهة على هذا الموقع لا يعني أنها تعتمده. وحين يُذكر دور تمثيلي أو استشاري فإنه يُذكر بصفته تلك، ولا يعني ملكية الجهة المذكورة.",
      ipHeading: "حقوق المحتوى",
      ip: "نصوص هذا الموقع وتصميمه محمية بحقوق النشر ما لم يُذكر خلاف ذلك. وتبقى شعارات الجهات ملكًا لأصحابها.",
      linksHeading: "الروابط الخارجية",
      links: "هذا الموقع غير مسؤول عن محتوى المواقع الخارجية التي يرتبط بها.",
    },
    /*
     * THE DISCLAIMERS ARE THE POINT OF THIS PAGE, SO THE DUTCH MUST DISCLAIM THE
     * SAME THINGS.
     *
     * This file's header explains that the "no investment offer" clause exists
     * because the subject works in business development and real estate, which is
     * adjacent enough to investment solicitation that the distinction has to be
     * stated rather than assumed. That reasoning is not language-specific: a Dutch
     * reader arriving from the Dutch market needs the same clause, so "geen
     * beleggingsaanbod" carries the same weight here as its English counterpart and
     * must not be softened into something vaguer.
     *
     * "vertegenwoordiging" rather than "eigendom" in the third-party clause is the
     * same careful distinction data/positions.json holds: she represents the IBC,
     * she does not own it. The organisation's name stays in English because it is a
     * legal name (see lib/localize.ts).
     */
    nl: {
      intro: "Deze website presenteert het professionele profiel van Sanae Rakik ter informatie.",
      adviceHeading: "Geen aanbod of advies",
      advice:
        "De inhoud van deze website beschrijft uitsluitend een professionele loopbaan. Niets op deze site vormt een beleggingsaanbod, een uitnodiging om te beleggen, of financieel of juridisch advies. Door deze site te bezoeken of er een bericht via te versturen ontstaat geen professionele relatie.",
      accuracyHeading: "Juistheid van de informatie",
      accuracy:
        "Functies en titels worden gepubliceerd samen met de volledige juridische naam van de betreffende organisatie. De informatie is juist op de datum van publicatie; als u een fout ziet, meld die dan en die wordt gecorrigeerd.",
      thirdPartyHeading: "Organisaties van derden",
      thirdParty:
        "Het noemen van een organisatie op deze website betekent niet dat die organisatie deze site onderschrijft. Waar een vertegenwoordigende of adviserende functie wordt beschreven, wordt die als zodanig beschreven en impliceert die geen eigendom van de genoemde organisatie.",
      ipHeading: "Rechten op de inhoud",
      ip: "De tekst en het ontwerp van deze website zijn auteursrechtelijk beschermd, tenzij anders vermeld. Logo's van organisaties blijven eigendom van de respectieve eigenaren.",
      linksHeading: "Externe links",
      links: "Deze website is niet verantwoordelijk voor de inhoud van externe sites waarnaar wordt gelinkt.",
    },
  }[locale as "en" | "ar" | "nl"] ?? {
    intro: "",
    adviceHeading: "",
    advice: "",
    accuracyHeading: "",
    accuracy: "",
    thirdPartyHeading: "",
    thirdParty: "",
    ipHeading: "",
    ip: "",
    linksHeading: "",
    links: "",
  }

  return (
    <LegalPage title={t("terms")} updated={UPDATED}>
      <p>{copy.intro}</p>

      {/* First, not last: the disclaimer intake section 6 requires is the clause a
          visitor most needs to have read, so it is not buried under content rights. */}
      <LegalHeading>{copy.adviceHeading}</LegalHeading>
      <p>{copy.advice}</p>

      <LegalHeading>{copy.accuracyHeading}</LegalHeading>
      <p>{copy.accuracy}</p>

      <LegalHeading>{copy.thirdPartyHeading}</LegalHeading>
      <p>{copy.thirdParty}</p>

      <LegalHeading>{copy.ipHeading}</LegalHeading>
      <p>{copy.ip}</p>

      <LegalHeading>{copy.linksHeading}</LegalHeading>
      <p>{copy.links}</p>
    </LegalPage>
  )
}
