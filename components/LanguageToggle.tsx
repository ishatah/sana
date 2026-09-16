"use client"

import { useLocale, useTranslations } from "next-intl"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"
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
 */
export function LanguageToggle() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
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
    startTransition(() => router.push(target))
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("language")}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          disabled={pending || l === locale}
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
