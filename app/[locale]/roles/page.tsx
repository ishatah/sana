import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { PageShell } from "@/components/page-shell"
import { PageHero } from "@/components/page-hero"
import { AnimeScope } from "@/components/motion/anime-scope"
import { SectionHeader } from "@/components/section-header"
import { RoleEntryList, composeRoles } from "@/components/role-entry"
import { PendingNote } from "@/components/pending-note"
import { getAwards, getPositions } from "@/lib/profile-content"
import { buildMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return buildMetadata(locale, { title: t("roles"), path: "/roles" })
}

/**
 * Roles and affiliations.
 *
 * ONE PAGE WHERE THERE WERE TWO. `/positions` and `/memberships` were separate
 * routes inherited from a subject who held six organisational posts and belonged
 * to several bodies. This subject holds one post and belongs to one organisation
 * — and they are the same organisation, so the two routes rendered a single row
 * each, naming the International Business Council twice across two pages.
 *
 * Intake section 3 checks both المناصب and العضويات والشراكات, and this page
 * carries both. What it does not do is pretend they are two relationships:
 * `composeRoles()` folds the position and the membership records into one entry
 * per organisation, so the page states the post, the affiliation and the
 * responsibility together, once.
 *
 * THE PARTNERSHIPS BLOCK IS SEPARATE AND DELIBERATELY EMPTY. Section 1 records
 * two commercial ventures she is a partner in, with the names "تُزوَّد لاحقًا
 * وتُعتمد قبل النشر" — supplied later and approved BEFORE publication. Both rows
 * sit at publish:false in data/positions.json, so nothing reaches this page.
 *
 * Naming the gap beats hiding it: the biography visible elsewhere on the site
 * mentions the partnerships, so a page titled Roles and Affiliations that showed
 * no trace of them would look like an omission rather than a pending approval.
 */
export default async function RolesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [positions, { memberships }] = await Promise.all([getPositions(), getAwards()])
  const t = await getTranslations()

  const roles = composeRoles(positions.current, memberships)
  const previous = composeRoles(positions.previous, [])

  /*
   * True while neither venture row is publishable.
   *
   * Read from the RAW ids rather than from a count, because `getPositions()` has
   * already filtered both rows out — a count would be zero whether the rows are
   * pending approval or were never there at all, and those are different things
   * to report.
   */
  const partnershipsPending = !positions.current.some((p) => p.id.startsWith("venture-partnership"))

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow={t("pages.roles.eyebrow")}
          title={t("pages.roles.title")}
          lede={t("pages.roles.lede")}
        />
      }
    >
      {roles.length > 0 && (
        <AnimeScope as="section" id="roles-current" interaction="hoverRule" className="snap-section page-section">
          <div className="container-page">
            <SectionHeader animate title={t("pages.roles.currentHeading")} />
            <RoleEntryList roles={roles} />
          </div>
        </AnimeScope>
      )}

      {previous.length > 0 && (
        <AnimeScope as="section" id="roles-previous" className="snap-section page-section page-section-alt">
          <div className="container-page">
            <SectionHeader animate title={t("positions.previous")} />
            <RoleEntryList roles={previous} />
          </div>
        </AnimeScope>
      )}

      {partnershipsPending && (
        <AnimeScope
          as="section"
          id="roles-partnerships"
          className="snap-section page-section page-section-alt"
        >
          <div className="container-page">
            <SectionHeader animate title={t("pages.roles.partnershipsHeading")} />
            <div data-anime="prose" className="max-w-2xl">
              <PendingNote>{t("draft.pendingSection")}</PendingNote>
            </div>
          </div>
        </AnimeScope>
      )}
    </PageShell>
  )
}
