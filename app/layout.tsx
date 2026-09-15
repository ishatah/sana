import { IBM_Plex_Sans_Arabic } from "next/font/google"
import { headers } from "next/headers"
import { LOCALE_HEADER } from "@/proxy"
import { routing, isRtl } from "@/i18n/routing"
import "./globals.css"

/*
 * IBM Plex Sans Arabic, THE ONLY FAMILY ON THE SITE, in both scripts and in
 * every role. Body, headings, display, eyebrows and numerals all resolve here.
 *
 * WHAT CHANGED AND WHY. This slot used to be half of a two-family pairing, with
 * Newsreader (a serif) carrying every heading via --font-display. That pairing
 * was deliberate, the argument was that one sans across all headings gave the
 * page contrast only through size. It was dropped on an explicit instruction to
 * run a single typeface, with hierarchy carried by WEIGHT AND SIZE instead of by
 * a change of family.
 *
 * That is a real trade: headings lose the serif's editorial register, and the
 * distinction between a heading and a bold paragraph is now weight and scale
 * alone. Plex Arabic takes the load reasonably well because it has genuine
 * stroke modulation rather than a monolinear geometric skeleton, so its 600/700
 * still reads as a heading rather than as shouted body copy.
 *
 * ONE UNAMBIGUOUS IMPROVEMENT: ~25 call sites set `font-display font-bold`, but
 * Newsreader was only ever loaded at 400/500. Every one of those was a
 * SYNTHESISED bold, the browser smearing the outline, and Plex ships a real
 * 700, so those headings now use a drawn weight.
 *
 * IT REPLACED CAIRO IN THIS SLOT, and the argument for the family being
 * Arabic-capable is now stronger than ever: a face that covers both scripts
 * means a heading can never fall back mid-word when it meets a glyph the face
 * lacks. With no second family in play, that guarantee is absolute.
 *
 * WHY MOVE OFF CAIRO AT ALL. Cairo is the default Arabic web face in the way
 * Open Sans was the default Latin one, it is on a very large share of Arabic
 * sites, and its geometric, near-monolinear construction gives every weight the
 * same even texture. That is a virtue in an interface and a liability on a
 * profile whose whole job is to look considered. Plex Arabic is drawn from the
 * Kufi/Naskh tradition with real stroke modulation, so Arabic headings have
 * actual typographic colour instead of uniform grey.
 *
 * IT ALSO CARRIES LATIN, which is what makes the one-family rule possible at
 * all. The Latin and Arabic cuts are designed together as one superfamily by
 * IBM's type team, so the two scripts share proportions and weight, a bilingual
 * line does not look like two fonts colliding.
 *
 * BOTH SUBSETS ARE PRELOADED, for the unchanged reason: this family is needed
 * for the first heading in every locale, so neither download is speculative.
 *
 * The weight range runs 400 through 700 rather than Cairo's 400–900. Plex Arabic
 * has no 800/900 cut, and it does not need one, its 700 is considerably darker
 * on the page than Cairo's was, so the hero weight that used 900 now uses 700
 * and lands in the same place. Nothing in styles/globals.css asks for a weight
 * this family does not ship.
 */
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["latin", "arabic"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headerList = await headers()
  const locale = headerList.get(LOCALE_HEADER) ?? routing.defaultLocale

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${plex.variable} no-js`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        {/* Removed synchronously before first paint, so `.no-js` only survives when
            scripting is genuinely unavailable. That is what un-hides `.reveal`,
            which is opacity:0 until the observer marks it visible, without this a
            failed bundle renders the page with nothing on it. Covers a blocked or
            errored bundle too, which <noscript> alone would not. */}
        <script dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.remove('no-js')` }} />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
