import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { Toaster } from "@/components/toaster"
import { SkipToContent } from "@/components/skip-to-content"
import { DraftBanner } from "@/components/draft-banner"
import { DraftBannerHeight } from "@/components/draft-banner-height"
import { routing, TIME_ZONE, type Locale } from "@/i18n/routing"
import { buildMetadata, buildPersonJsonLd } from "@/lib/seo"

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return buildMetadata(locale)
}

/**
 * The locale layout — and the only place the public site's chrome is assembled.
 *
 * Everything locale-aware lives here rather than in the root layout, because this
 * is the first point at which `setRequestLocale` has run and the locale is known
 * for certain. See the note in app/layout.tsx: locale logic placed above this
 * segment resolves to the default for EVERY locale, which rendered lang="tr" and
 * Turkish position titles on /en and /ar while the client components below
 * correctly rendered English — half the page in each language.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }

  setRequestLocale(locale)

  // Direct import rather than next-intl's own message loading: that can resolve
  // before setRequestLocale has taken effect in this render pass, which yields the
  // default locale's messages inside a non-default locale's tree.
  //
  // English is the fallthrough because it is `defaultLocale`. The unreachable-
  // locale case is already handled above — `notFound()` fires on anything outside
  // `routing.locales` — so this branch only ever sees "en" or "ar".
  const messages =
    locale === "ar"
      ? (await import("@/messages/ar.json")).default
      : (await import("@/messages/en.json")).default

  const jsonLd = await buildPersonJsonLd(locale)

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={TIME_ZONE}>
      {/* `lang` and `dir` are set on <html> by the root layout, which reads the
          locale from the header proxy.ts attaches — see the note there. */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/*
        MotionProvider is deliberately absent.

        It wrapped this whole tree in a "use client" boundary to load Motion's
        `domAnimation` bundle — for zero consumers. Nothing on this site renders
        an `m.*` element, AnimatePresence, useScroll or any other Motion
        primitive; components/motion/reveal.tsx is a hand-written
        IntersectionObserver toggling one CSS class, which is why the dependency
        was never actually reached. The provider was pure bundle weight and an
        unnecessary client boundary at the top of every page.
      */}
      <SkipToContent />
      {/* Renders only while the intake form's section 18 sign-off is
          incomplete. See components/draft-banner.tsx. */}
      <DraftBanner />
      {/* Measures the banner above into --draft-banner-height. Renders nothing;
          when the banner is absent it finds no element and does nothing. */}
      <DraftBannerHeight />
      {children}
      <Toaster position="bottom-right" theme="dark" richColors />
    </NextIntlClientProvider>
  )
}
