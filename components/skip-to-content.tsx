"use client"

import { useTranslations } from "next-intl"

/** Visible only on keyboard focus. First thing in the tab order, so a keyboard or
 *  screen-reader user can jump the nav on a one-page site where the anchor menu is
 *  otherwise seven links deep on every visit. */
export function SkipToContent() {
  const t = useTranslations("nav")
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:bg-[color:var(--primary)] focus:px-4 focus:py-2 focus:font-display focus:text-xs focus:font-bold focus:uppercase focus:tracking-widest focus:text-[color:var(--primary-foreground)]"
    >
      {t("skipToContent")}
    </a>
  )
}
