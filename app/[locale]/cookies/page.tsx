import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { LegalPage, LegalHeading } from "@/components/legal/legal-page"
import { buildMetadata } from "@/lib/seo"

const UPDATED = "2026-09-10"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "legal" })
  return buildMetadata(locale, { title: t("cookies"), path: "/cookies" })
}

/**
 * Cookie policy.
 *
 * There is no consent banner on this site, and that is a factual position rather
 * than an omission: the public pages set no cookies at all. Consent is required
 * for storage that is not strictly necessary, and there is none, so a banner
 * would be asking permission for something that never happens, which trains people
 * to dismiss banners that do matter.
 *
 * The page exists anyway because the question is reasonable to ask, and the
 * answer, none, is worth being able to point at. Add a banner the day an
 * analytics or embed dependency is introduced; that is the trigger, not launch.
 */
export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("legal")

  const copy = {
    en: {
      intro: "No cookies are set on the public pages of this site.",
      whyHeading: "Why there is no consent banner",
      why: "Consent is required for storage that is not strictly necessary. This site has no analytics, no advertising trackers and no third-party embeds, so there is nothing to ask consent for.",
      adminHeading: "Administration session",
      admin:
        "A single cookie is created when signing in to the administration panel, to keep that session open. It is strictly necessary, it does not track anything, and it does not affect visitors.",
      changeHeading: "If this changes",
      change:
        "If analytics or embedded content are added in future, this page will be updated and the appropriate consent mechanism added.",
    },
    ar: {
      intro: "لا تُستخدم ملفات ارتباط في الصفحات العامة لهذا الموقع.",
      whyHeading: "لماذا لا يوجد إشعار موافقة",
      why: "تُطلب الموافقة للتخزين غير الضروري تمامًا. ولا يتضمن هذا الموقع أدوات تحليل أو تتبعًا إعلانيًا أو محتوى مضمَّنًا من طرف ثالث، فلا يوجد ما تُطلب الموافقة عليه.",
      adminHeading: "جلسة الإدارة",
      admin:
        "يُنشأ ملف ارتباط واحد عند تسجيل الدخول إلى لوحة الإدارة لإبقاء الجلسة مفتوحة. وهو ضروري تمامًا، ولا يتتبع شيئًا، ولا يؤثر على الزوار.",
      changeHeading: "إذا تغيّر ذلك",
      change: "إذا أُضيفت أدوات تحليل أو محتوى مضمَّن مستقبلًا، ستُحدَّث هذه الصفحة وتُضاف آلية الموافقة المناسبة.",
    },
    /*
     * "er worden geen cookies geplaatst", NOT "ingesteld". Cookies are *placed* in
     * Dutch, and this page's whole claim is that none are, so the one verb it turns
     * on should be the one a Dutch reader actually uses.
     *
     * "strikt noodzakelijk" is deliberate and is a term of art: it is the AVG /
     * ePrivacy category that exempts a cookie from requiring consent, and it is the
     * precise reason this site has no banner. The English says "strictly necessary"
     * for the same reason. Softening it to "nodig" would drop the legal basis and
     * leave the page asserting an exemption it no longer explains.
     */
    nl: {
      intro: "Op de openbare pagina's van deze website worden geen cookies geplaatst.",
      whyHeading: "Waarom er geen cookiemelding is",
      why: "Toestemming is vereist voor opslag die niet strikt noodzakelijk is. Deze site heeft geen statistieksoftware, geen advertentietrackers en geen ingesloten inhoud van derden, dus er is niets waarvoor toestemming gevraagd moet worden.",
      adminHeading: "Beheersessie",
      admin:
        "Bij het inloggen op het beheerpaneel wordt één cookie aangemaakt om die sessie open te houden. Die is strikt noodzakelijk, houdt niets bij, en raakt bezoekers niet.",
      changeHeading: "Als dit verandert",
      change:
        "Als er in de toekomst statistieksoftware of ingesloten inhoud wordt toegevoegd, wordt deze pagina bijgewerkt en wordt de juiste toestemmingsmelding toegevoegd.",
    },
  }[locale as "en" | "ar" | "nl"] ?? { intro: "", whyHeading: "", why: "", adminHeading: "", admin: "", changeHeading: "", change: "" }

  return (
    <LegalPage title={t("cookies")} updated={UPDATED}>
      <p>{copy.intro}</p>

      <LegalHeading>{copy.whyHeading}</LegalHeading>
      <p>{copy.why}</p>

      <LegalHeading>{copy.adminHeading}</LegalHeading>
      <p>{copy.admin}</p>

      <LegalHeading>{copy.changeHeading}</LegalHeading>
      <p>{copy.change}</p>
    </LegalPage>
  )
}
