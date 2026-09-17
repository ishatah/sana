"use client"

import { useLocale, useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import { routing } from "@/i18n/routing"

/**
 * The visible label per locale, and the one thing here that a new locale must touch.
 *
 * Two-letter uppercase codes rather than native names ("Nederlands", "العربية"): the
 * control sits in the masthead beside the nav, where three native names would not fit
 * at phone width, and a code is what a returning visitor scans for. A missing entry
 * renders an EMPTY BUTTON rather than throwing, so this list is the reason a new
 * locale gets checked visually and not only in a build log.
 */
const LABELS: Record<string, string> = { en: "EN", ar: "AR", nl: "NL" }

/**
 * Locale switcher.
 *
 * The current path is rewritten rather than pushed to a fixed route, so switching
 * language on /privacy stays on /privacy. English is `defaultLocale` with
 * `localePrefix: "as-needed"`, so its URLs carry no prefix at all while /ar and /nl
 * do, and the stripping below has to handle both shapes.
 *
 * The button list itself comes from `routing.locales`, so the count follows the
 * routing config; only LABELS above needs a line per locale.
 *
 * IT FORCES A FULL PAGE LOAD, AND THAT IS NOT LAZINESS.
 *
 * This used `router.push()` inside a `useTransition`, which is the idiomatic App
 * Router navigation and is WRONG for this one control. `<html lang>` and
 * `<html dir>` are written by the ROOT layout (app/layout.tsx), which sits above
 * the `[locale]` segment and reads the locale from the `x-app-locale` header that
 * proxy.ts attaches to each REQUEST. A soft navigation re-renders the route tree
 * without a new document request, so the root layout never re-runs and those two
 * attributes keep whatever the first load set.
 *
 * Measured before the change: clicking AR from `/` gave `/ar` with Arabic copy
 * ("أنا", "تواصل معنا") inside `<html lang="en" dir="ltr">`. Arabic text in a
 * left-to-right document, with the wrong language announced to a screen reader.
 * The content switched and the document did not, which is the worst shape for
 * this bug because it looks like it worked.
 *
 * `window.location.assign()` issues a real request, so the proxy runs, the header
 * is set, the root layout re-renders, and `lang`/`dir` land correctly. The cost is
 * a full reload on one click, which is the right trade: a language switch is a
 * deliberate, infrequent act, and it is the single navigation on this site where
 * the document element itself has to change.
 */
export function LanguageToggle() {
  const locale = useLocale()
  const pathname = usePathname()
  // The group needs a name for screen readers, and "Language" was hardcoded English
  // on the one control whose entire purpose is to leave English. `footer.language`
  // already carries the word in every catalogue, so the label now switches with the
  // rest of the interface.
  const t = useTranslations("footer")

  const switchTo = (next: string) => {
    // Strip any existing locale segment, then re-add unless the target is the
    // unprefixed default.
    const stripped = pathname.replace(new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`), "") || "/"
    const target = next === routing.defaultLocale ? stripped : `/${next}${stripped === "/" ? "" : stripped}`

    /*
     * `assign`, not `replace`: the page they came from is a real step in their
     * history and Back should return to it in the language they were reading.
     * `replace` would swallow that entry and send Back to whatever preceded it,
     * which on a first visit is the site they arrived from.
     *
     * Not `router.push` - see the docblock. This has to be a document request.
     */
    window.location.assign(target)
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("language")}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          disabled={l === locale}
          aria-current={l === locale ? "true" : undefined}
          // min-h/min-w 44px: the visible label is 11px type in a 28x28 box,
          // which is under the 44x44 touch target WCAG 2.5.5 asks for and the
          // hardest control on the page to hit on a phone. The padding stays
          // small so the ink is unchanged, only the hit area grows.
          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1.5 py-1 font-display text-[0.7rem] font-bold tracking-[0.15em] transition-colors ${
            l === locale
              ? "text-[color:var(--primary-strong)]"
              : "text-[color:var(--muted-foreground)] hover:text-[color:var(--heading)]"
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  )
}
