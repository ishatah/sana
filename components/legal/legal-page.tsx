import { getTranslations } from "next-intl/server"
import { PageShell } from "@/components/page-shell"
import { SectionHeader } from "@/components/section-header"

/**
 * Shared shell for the three legal routes.
 *
 * The chrome, nav, main, footer, header clearance, href resolution, now lives
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
          else entirely. Everywhere content is left-aligned, which is everywhere
          else, the heading now defaults to `start`.
        */}
        <SectionHeader title={title} align="center" />
        {/*
          THE LEGAL PAGES NOW ANIMATE, AND THIS IS THE MOST RESTRAINED PLACE ON
          THE SITE FOR IT, deliberately, because it is the least appropriate.

          These are the pages a reader opens to get a definite answer about how
          their data is handled. Motion on a privacy notice is decoration on top
          of a document whose whole value is being plain. So the reveal here is
          the quietest the site has: `rise-light`, which floors at 0.4 opacity
          and is fully resolved by 32% of cover, finished well before the
          paragraph reaches the middle of the viewport where it is actually read.

          IT IS CSS-ONLY, WHICH IS WHY THIS FILE HAS NO "use client". A wrapper
          component would drag the whole legal subtree across the client boundary
          to animate text that never changes. `animation-timeline: view()` needs
          no observer, so these three routes still ship zero JavaScript.

          `[&>*]` applies it to each direct child, every paragraph and heading,
          rather than to the article as one block, so the document resolves in
          reading order instead of arriving whole.
        */}
        <article className="legal-prose mx-auto max-w-2xl space-y-6 text-sm leading-[1.9] text-[color:var(--foreground)]">
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
