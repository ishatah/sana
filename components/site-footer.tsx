import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { getNavigation } from "@/lib/profile-content"
import { getSiteSettings } from "@/lib/site-settings"
import { localize } from "@/lib/localize"
import { routing } from "@/i18n/routing"

/**
 * The footer. Copyright line, legal links, and a social rail.
 *
 * The social rail renders nothing today and that is correct: intake section 13
 * records LinkedIn as "Not supplied", so `settings.social` is an empty array. The
 * template hardcodes five placeholder icons pointing at "#" — five dead links on
 * a profile whose entire purpose is credibility. An absent rail is better than a
 * broken one, so the block is conditional on there being something real in it.
 */
export async function SiteFooter() {
  const [settings, navigation] = await Promise.all([getSiteSettings(), getNavigation()])
  const locale = await getLocale()
  const t = await getTranslations("footer")

  const social = (settings.social ?? []) as { id: string; label: string; url: string }[]
  const legal = (navigation.legal ?? []) as { id: string; href: string; label: any }[]

  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`

  return (
    <footer className="border-t border-[color:var(--border)] py-10">
      <div className="container-page flex flex-col items-center justify-between gap-6 sm:flex-row">
        <p className="text-xs text-[color:var(--muted-foreground)]">
          {t("copyright", { year: new Date().getFullYear(), name: settings.siteName })}
        </p>

        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {legal.map((item) => (
            <Link
              key={item.id}
              href={`${prefix}${item.href}`}
              // The legal links are 16px tall as bare text. `py-3` lifts the hit
              // area to ~44px without moving the baseline, since the row is
              // centred and the added padding is symmetric.
              className="inline-flex min-h-[44px] items-center py-3 text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary-strong)]"
            >
              {localize(item.label, locale)}
            </Link>
          ))}
        </nav>

        {social.length > 0 && (
          <ul className="flex items-center gap-4">
            {social.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary-strong)]"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  )
}
