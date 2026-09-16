import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { Toaster } from "@/components/toaster"
import { SkipToContent } from "@/components/skip-to-content"
import { ReadingRail } from "@/components/motion/fm/scroll-physics"
import { AtmosphereRoot } from "@/components/motion/fm/atmosphere-root"
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
 * The locale layout, and the only place the public site's chrome is assembled.
 *
 * Everything locale-aware lives here rather than in the root layout, because this
 * is the first point at which `setRequestLocale` has run and the locale is known
 * for certain. See the note in app/layout.tsx: locale logic placed above this
 * segment resolves to the default for EVERY locale, which rendered lang="tr" and
 * Turkish position titles on /en and /ar while the client components below
 * correctly rendered English, half the page in each language.
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
  // ── DRIVEN BY THE LOCALE, NOT BRANCHING ON IT ─────────────────────────────────
  //
  // This was `locale === "ar" ? ar.json : en.json`, with a note claiming the branch
  // "only ever sees 'en' or 'ar'". That was true when there were two locales and
  // became false the moment a third was added, in the worst possible way: Dutch fell
  // down the else and rendered the ENGLISH catalogue inside a lang="nl" document. No
  // throw, no warning, no failed build. A page that looks finished and is not.
  //
  // The template literal cannot have that failure mode, because there is no fallback
  // arm for a locale to fall into, a catalogue either exists or the import throws
  // loudly at build time. Same shape as i18n/request.ts, which loads the server
  // config this way for the same reason.
  //
  // Safe as a dynamic segment because `notFound()` above has already rejected
  // anything outside `routing.locales`, so this only ever interpolates a locale the
  // routing config declares. Adding a fourth locale needs a catalogue file and
  // nothing in this file.
  const messages = (await import(`@/messages/${locale}.json`)).default

  const jsonLd = await buildPersonJsonLd(locale)

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={TIME_ZONE}>
      {/* `lang` and `dir` are set on <html> by the root layout, which reads the
          locale from the header proxy.ts attaches, see the note there. */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/*
        MotionProvider is deliberately absent.

        It wrapped this whole tree in a "use client" boundary to load Motion's
        `domAnimation` bundle, for zero consumers. Nothing on this site renders
        an `m.*` element, AnimatePresence, useScroll or any other Motion
        primitive; components/motion/reveal.tsx is a hand-written
        IntersectionObserver toggling one CSS class, which is why the dependency
        was never actually reached. The provider was pure bundle weight and an
        unnecessary client boundary at the top of every page.
      */}
      <SkipToContent />

      {/*
        THE READING RAIL, A14. A hairline across the top of the viewport tracking
        progress through the document.

        ── IT DOES NOT REOPEN THE BOUNDARY THE NOTE ABOVE CLOSED ─────────────────

        The removal note immediately above is about a PROVIDER, a client
        component wrapping `{children}`, which drags the entire page tree across
        the boundary. This is a LEAF: a self-closing sibling with no children, so
        the client bundle it pulls in is itself and `FmRoot`, and every section
        below it stays a server component exactly as before.

        That distinction is the whole reason it can live here rather than being
        repeated in five route files. A wrapper's cost is its subtree; a leaf's
        cost is itself.

        ── AND WHY IT IS HERE RATHER THAN PER-ROUTE ─────────────────────────────

        It measures the WHOLE DOCUMENT (`useScroll()` with no target), so there is
        exactly one correct instance of it per page. Rendering it per section would
        give five rails all reporting the same number and stacked on the same 2px.
      */}
      <ReadingRail className="reading-rail" />

      {/*
        THE ATMOSPHERE, the document's single light source, weather clock and
        scroll-physics signal, plus the three fixed texture overlays that read
        from them.

        ── IT IS HERE FOR THE SAME REASON `ReadingRail` IS, AND NO OTHER ────────

        It is a LEAF: a self-closing sibling with no children, so the client
        bundle it pulls in is itself and every section below stays a server
        component. The removal note above is about a PROVIDER wrapping
        `{children}`; this re-opens nothing.

        ── AND IT MUST BE PER-DOCUMENT RATHER THAN PER-SECTION ─────────────────

        The whole argument of components/motion/fm/atmosphere.tsx is that there is
        ONE light for the page. Mounting it per band would give each band its own
        pointer listener and its own idea of where the light is, which is exactly
        the collection-of-tricks outcome that file exists to prevent.
      */}
      <AtmosphereRoot />

      {/*
        EFFECT 25, THE NOISE LAYER, AND IT IS A FIX RATHER THAN A FLOURISH.

        It is here, at document level, for the same leaf argument as the two
        components above: self-closing, no children, no boundary re-opened.

        WHY IT IS REQUIRED RATHER THAN OPTIONAL. Several of the new colour
        effects, the hero mesh most of all, are low-alpha gradients spanning a
        few luminance steps just above #0A0A0B. An 8-bit panel quantises that
        range hard, and the result is visible concentric banding rather than a
        smooth falloff. A 2% noise layer dithers the step boundaries and the
        banding disappears. Remove this and the mesh gains contour rings.

        It must be per-document rather than per-section for a plainer reason than
        the atmosphere's: it is `position: fixed`, so a second instance would be
        a second full-viewport layer painting the same texture over the first.

        EFFECT 39 (scroll progress) IS NOT MOUNTED HERE. `ReadingRail` above
        already is that effect, a hairline across the top of the viewport
        tracking document progress, and its note explains there is exactly one
        correct instance per page. Adding .scroll-progress would put a second 2px
        bar on the same 2px of screen, both reporting the same number. The class
        exists in globals.css for a page that does not mount the rail.
      */}
      <div aria-hidden className="noise-overlay noise-velocity" />

      {children}
      <Toaster position="bottom-right" theme="dark" richColors />
    </NextIntlClientProvider>
  )
}
