import { IBM_Plex_Sans_Arabic, Newsreader } from "next/font/google"
import { headers } from "next/headers"
import { LOCALE_HEADER } from "@/proxy"
import { routing, isRtl } from "@/i18n/routing"
import { getDeliverables } from "@/lib/site-settings"
import { isSignedOff } from "@/lib/verification"
import "./globals.css"

/*
 * IBM Plex Sans Arabic — the body face, and the only family Arabic ever sees.
 *
 * IT REPLACES CAIRO IN EXACTLY THE SAME ROLE, and the argument for having ONE
 * Arabic-capable family here is unchanged: a face that covers both scripts means
 * a heading can never fall back mid-word when it meets a glyph the display face
 * lacks. What changed is which family fills the slot.
 *
 * WHY MOVE OFF CAIRO AT ALL. Cairo is the default Arabic web face in the way
 * Open Sans was the default Latin one — it is on a very large share of Arabic
 * sites, and its geometric, near-monolinear construction gives every weight the
 * same even texture. That is a virtue in an interface and a liability on a
 * profile whose whole job is to look considered. Plex Arabic is drawn from the
 * Kufi/Naskh tradition with real stroke modulation, so Arabic headings have
 * actual typographic colour instead of uniform grey.
 *
 * IT ALSO CARRIES LATIN, which Cairo did too, and that is what keeps the
 * one-family guarantee intact. The Latin and Arabic cuts are designed together
 * as one superfamily by IBM's type team, so the two scripts share proportions
 * and weight — a bilingual line does not look like two fonts colliding.
 *
 * BOTH SUBSETS ARE PRELOADED, for the unchanged reason: this family is needed
 * for the first heading in every locale, so neither download is speculative.
 *
 * The weight range runs 400 through 700 rather than Cairo's 400–900. Plex Arabic
 * has no 800/900 cut, and it does not need one — its 700 is considerably darker
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

/*
 * Newsreader — the DISPLAY face, and Latin-only by design.
 *
 * The reason a second family exists is unchanged from when Instrument Serif held
 * this slot: one sans across every heading gave the site no typographic contrast,
 * only size, and that was the single biggest reason it read as templated.
 *
 * WHY NEWSREADER RATHER THAN INSTRUMENT SERIF. Instrument Serif is a genuine
 * display face, but it ships ONE weight and a very high stroke contrast tuned for
 * large sizes — which made it excellent in the hero and brittle everywhere else,
 * and gave the site no way to set a heading at 1.25rem without it looking thin
 * and decorative. Newsreader is a text-first face from Production Type drawn on
 * 16th-century Dutch models, with an optical-size axis: at `opsz` 72 it has the
 * sharp serifs and contrast of a display cut, and it still holds together at
 * reading size, which is where most of this site's headings actually live.
 *
 * ITS REGISTER IS THE POINT. Newsreader reads as a newspaper of record — sober,
 * authoritative, institutional. That is what this document is: a profile whose
 * job is to make a set of titles credible. Instrument Serif's high-contrast
 * elegance was closer to a fashion masthead.
 *
 * THE ONE-FAMILY DECISION IS STILL NOT REGRESSED. Newsreader has no Arabic
 * coverage, so it is never offered to Arabic: `[dir="rtl"]` in styles/globals.css
 * repoints --font-display back to the Plex family, exactly as it did for
 * Instrument Serif. Arabic headings never reference this family at all.
 *
 * Only `latin` is subset, so the Arabic range is not downloaded.
 */
const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display-latin",
  display: "swap",
  weight: ["400", "500"],
  style: ["normal", "italic"],
})

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headerList = await headers()
  const locale = headerList.get(LOCALE_HEADER) ?? routing.defaultLocale

  // The draft banner and the site header are both `fixed`, so the header has to be
  // offset by the banner's height or it renders on top of it. This attribute is
  // what the [data-draft-banner] rules in styles/globals.css key off.
  //
  // It is resolved on the server rather than set by a script in the banner itself:
  // mutating <body> before hydration is a hydration mismatch, and React does not
  // patch up attribute differences on the host element. Reading the same sign-off
  // record the banner reads keeps the two in step.
  const deliverables = await getDeliverables()
  const draft = !isSignedOff(deliverables.signOff)

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${plex.variable} ${display.variable} no-js`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        {/* Removed synchronously before first paint, so `.no-js` only survives when
            scripting is genuinely unavailable. That is what un-hides `.reveal`,
            which is opacity:0 until the observer marks it visible — without this a
            failed bundle renders the page with nothing on it. Covers a blocked or
            errored bundle too, which <noscript> alone would not. */}
        <script dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.remove('no-js')` }} />
      </head>
      <body className="font-sans antialiased" {...(draft ? { "data-draft-banner": "" } : {})}>
        {children}
      </body>
    </html>
  )
}
