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
  }[locale as "en" | "ar"] ?? {
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
