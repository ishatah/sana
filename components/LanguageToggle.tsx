"use client"

import { useLocale } from "next-intl"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"
import { routing } from "@/i18n/routing"

const LABELS: Record<string, string> = { en: "EN", ar: "AR" }

/**
 * Locale switcher.
 *
 * The current path is rewritten rather than pushed to a fixed route, so switching
 * language on /privacy stays on /privacy. Turkish is `defaultLocale` with
 * `localePrefix: "as-needed"`, so its URLs carry no prefix at all, the stripping
 * below has to handle both shapes.
 */
export function LanguageToggle() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const switchTo = (next: string) => {
    // Strip any existing locale segment, then re-add unless the target is the
    // unprefixed default.
    const stripped = pathname.replace(new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`), "") || "/"
    const target = next === routing.defaultLocale ? stripped : `/${next}${stripped === "/" ? "" : stripped}`
    startTransition(() => router.push(target))
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Language">
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
