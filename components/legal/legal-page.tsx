import { getTranslations } from "next-intl/server"
import { PageShell } from "@/components/page-shell"
import { SectionHeader } from "@/components/section-header"

/**
 * Shared shell for the three legal routes.
 *
 * The chrome — nav, main, footer, header clearance, href resolution — now lives
 * in `PageShell`, which the five content pages share. What stays here is the part
 * that is actually legal-specific: a narrow prose column and the "last updated"
 * line. Passing no `hero` is what keeps the `pt-32` header clearance, since these
 * pages open straight into text.
 */
export async function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  const t = await getTranslations("legal")

  return (
    <PageShell>
      <div className="container-page">
        {/*
          One of the two places `align="center"` is still correct. The article
          below is a centred `max-w-2xl` column, so a start-aligned heading would
          sit against the page gutter while the prose it labels begins somewhere
          else entirely. Everywhere content is left-aligned — which is everywhere
          else — the heading now defaults to `start`.
        */}
        <SectionHeader title={title} align="center" />
        <article className="mx-auto max-w-2xl space-y-6 text-sm leading-[1.9] text-[color:var(--foreground)]">
          {children}
          <p className="border-t border-[color:var(--border)] pt-6 text-xs text-[color:var(--muted-foreground)]">
            {t("lastUpdated")}: {updated}
          </p>
        </article>
      </div>
    </PageShell>
  )
}

/** A heading inside a legal document. */
export function LegalHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-4 font-display text-base font-bold text-[color:var(--heading)]">{children}</h2>
}
