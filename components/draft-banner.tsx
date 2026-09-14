import { getTranslations, getLocale } from "next-intl/server"
import { getDeliverables } from "@/lib/site-settings"
import { isSignedOff } from "@/lib/verification"

/**
 * The pre-launch banner.
 *
 * It renders on every page while the intake form's section 18 sign-off is
 * incomplete, and disappears on its own the moment it is complete — there is no
 * flag to remember to remove, because the thing that removes it is the same record
 * that authorises publication.
 *
 * WHY IT IS VISIBLE RATHER THAN A COMMENT IN THE SOURCE. A staging URL gets
 * forwarded. A profile that looks finished gets treated as finished, and the
 * titles on a page like this — the post someone holds, the bodies they represent
 * — are exactly the claims the verification tiers exist to keep from circulating
 * before they are confirmed in writing. On this profile the start date of the one
 * current position is still unconfirmed, which is precisely the kind of detail a
 * forwarded draft would harden into fact. A banner is the cheapest way to make
 * "not approved yet" travel with the link.
 *
 * It is also why the site is noindex until sign-off (see lib/seo.ts): the banner
 * handles the human who receives the link, the robots directive handles everyone
 * who would otherwise find it without one.
 */
export async function DraftBanner() {
  const deliverables = await getDeliverables()
  if (isSignedOff(deliverables.signOff)) return null

  const t = await getTranslations("draft")
  const locale = await getLocale()

  return (
    <div
      role="status"
      // aria-live is deliberately absent: this is present on first paint and never
      // changes, so announcing it as a live update would interrupt a screen reader
      // mid-navigation on every route change. role="status" alone puts it in the
      // accessibility tree where it can be read in document order.
      //
      // `fixed`, above the header's z-40. The header is itself fixed, so a banner
      // in normal flow sits underneath it and is covered on every page.
      //
      // The header is shifted down by the [data-draft-banner] rules in
      // styles/globals.css, keyed off an attribute the root layout renders on
      // <body>. That attribute is set server-side rather than by a script here:
      // mutating <body> before hydration is a hydration mismatch, and React
      // explicitly does not patch attribute differences on the host element.
      //
      // NO FIXED HEIGHT, AND NO overflow-hidden. Both were here before and
      // together they truncated the notice: at 360px the copy wraps to three
      // lines (83px) inside a 48px box, so the visible text ended mid-sentence
      // at "...has not been approved for". The one message that must never be
      // clipped is the one saying this page is not approved — a passer-by who
      // reads half of it is exactly the reader the banner exists for.
      //
      // The box now sizes to its content, and components/draft-banner-height.tsx
      // measures the result into `--draft-banner-height` so the header and hero
      // offsets follow it at any width and in any locale.
      data-draft-banner-el
      className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--warning)]/30 bg-[color:var(--background)] px-5 py-2.5"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <div className="container-page flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <span className="font-display text-[0.7rem] font-bold uppercase tracking-[0.25em] text-[color:var(--warning)]">
          {t("badge")}
        </span>
        <span className="text-xs leading-relaxed text-[color:var(--card-foreground)]/80">{t("notice")}</span>
      </div>
    </div>
  )
}
