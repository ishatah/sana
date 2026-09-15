import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { PageShell } from "@/components/page-shell"
import { PageHero } from "@/components/page-hero"
import { MotionScope } from "@/components/motion/motion-scope"
import { BandTone } from "@/components/motion/fm/band-tone"
import { SectionHeader } from "@/components/section-header"
import { RoleEntryList, composeRoles } from "@/components/role-entry"
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
 *, and they are the same organisation, so the two routes rendered a single row
 * each, naming the International Business Council twice across two pages.
 *
 * Intake section 3 checks both المناصب and العضويات والشراكات, and this page
 * carries both. What it does not do is pretend they are two relationships:
 * `composeRoles()` folds the position and the membership records into one entry
 * per organisation, so the page states the post, the affiliation and the
 * responsibility together, once.
 *
 * The two commercial ventures recorded in intake section 1 sit at publish:false
 * in data/positions.json, so nothing about them reaches this page.
 */
export default async function RolesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [positions, { memberships }] = await Promise.all([getPositions(), getAwards()])
  const t = await getTranslations()

  const roles = composeRoles(positions.current, memberships)
  const previous = composeRoles(positions.previous, [])

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
        <MotionScope as="section" id="roles-current" recipe="ledgerRows" interaction="hoverRule" physics className="section-skew snap-section page-section">
          <BandTone />
          <div className="container-page">
            <SectionHeader animate title={t("pages.roles.currentHeading")} />
            {/*
              NESTED, BECAUSE ONE SCOPE CARRIES ONE INTERACTION.

              MotionScope takes a single `interaction` and mounts it against its own
              root, so a section needing two behaviours nests rather than combining
              them. The outer scope owns `hoverRule` for the whole section; this
              inner one owns the verification marks and queries only its own
              subtree, which is the scoping guarantee motion-scope.tsx describes.

              Each keeps its own teardown, so neither can strand the other's state.
            */}
            <MotionScope interaction="verifyMarks">
              <RoleEntryList roles={roles} />
            </MotionScope>
          </div>
        </MotionScope>
      )}

      {previous.length > 0 && (
        <MotionScope
          as="section"
          id="roles-previous" recipe="ledgerRows"
          interaction="verifyMarks"
          physics
          className="section-skew snap-section page-section page-section-alt"
        >
          <BandTone />
          <div className="container-page">
            <SectionHeader animate title={t("positions.previous")} />
            <RoleEntryList roles={previous} />
          </div>
        </MotionScope>
      )}

    </PageShell>
  )
}
