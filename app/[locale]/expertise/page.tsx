import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { PageShell } from "@/components/page-shell"
import { PageHero } from "@/components/page-hero"
import { AnimeScope } from "@/components/motion/anime-scope"
import { SectionHeader } from "@/components/section-header"
import { ExpertiseGrid } from "@/components/expertise-grid"
import { getIdentity, getHeadline, getExpertise } from "@/lib/profile-content"
import { localize } from "@/lib/localize"
import { buildMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "nav" })
  return buildMetadata(locale, { title: t("expertise"), path: "/expertise" })
}

/**
 * The expertise page.
 *
 * Two sections from two existing sources: the seven areas (`ExpertiseGrid`,
 * reused) and the markets she covers (`identity` + `headline.locations`,
 * assembled here).
 *
 * A third section listed the working languages. It is removed from display at the
 * client's request — the rows, the /admin/expertise editor and open question q1
 * all survive in place, so restoring it is one commit once the MUST CONFIRM
 * levels in intake section 8 are answered.
 *
 * Nothing is described or characterised. The intake form asked for "short noun
 * phrases, no sentences" and that is what exists, so the grid carries phrases and
 * the markets section carries labelled facts — no invented prose elaborating on
 * what any of the listed capabilities involves.
 */
export default async function ExpertisePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [identity, headline, expertise] = await Promise.all([getIdentity(), getHeadline(), getExpertise()])
  const t = await getTranslations()

  // `pair` links a market card to the location entry below it, so hovering one
  // highlights the other. Keyed by meaning rather than by index: the two lists
  // come from different data files and either could be reordered independently.
  const markets = [
    { pair: "sector", label: t("pages.expertise.sectorLabel"), value: localize(identity.sector, locale) },
    { pair: "base", label: t("pages.expertise.baseLabel"), value: localize(identity.residence, locale) },
    { pair: "markets", label: t("pages.expertise.marketsLabel"), value: localize(identity.otherMarkets, locale) },
  ].filter((m) => m.value)

  const locations = (headline.locations ?? []) as { label: any; value: any }[]

  return (
    <PageShell
      hero={
        <PageHero
          eyebrow={t("pages.expertise.eyebrow")}
          title={t("expertise.heading")}
          lede={t("pages.expertise.lede")}
        />
      }
    >
      {/*
        NO RECIPE AND NO INTERACTION ON THIS SECTION, deliberately.

        It carried `gridCascade` + `gridNeighbours`, both of which selected hooks
        that `ExpertiseGrid` no longer renders: it was rewritten from an icon grid
        of `[data-anime="panel"]` cells into a numbered <ol>, and its docblock
        removes the `tabIndex={0}` those hooks needed, calling it "a real
        accessibility cost paid for decoration". That reasoning holds — seven tab
        stops that do nothing on arrival is a worse trade than a missing hover
        effect.

        Leaving the props would have been the quieter failure: anime.js finds no
        targets, logs a console warning, and the section simply never animates
        while the source still claims it does.

        The list is not left static — every row is inside a `Reveal`, which is the
        site's baseline entry animation.
      */}
      <AnimeScope as="section" id="expertise-areas" className="snap-section page-section">
        <div className="container-page">
          <SectionHeader animate title={t("pages.expertise.areasHeading")} subtitle={t("expertise.subheading")} />
          <ExpertiseGrid items={expertise.items ?? []} />
        </div>
      </AnimeScope>

      {(markets.length > 0 || locations.length > 0) && (
        <AnimeScope
          as="section"
          id="expertise-markets"
          interaction="linkedPair"
          className="snap-section page-section page-section-alt"
        >
          <div className="container-page">
            <SectionHeader animate title={t("pages.expertise.marketsHeading")} />

            <dl className="mx-auto grid max-w-3xl gap-8 sm:grid-cols-3">
              {markets.map((m) => (
                <div
                  key={m.label}
                  data-anime="panel"
                  data-pair={m.pair}
                  // Focusable so the pairing highlight is reachable without a
                  // pointer — the interaction binds focusin alongside pointerenter.
                  tabIndex={0}
                  className="card-ruled panel-3d p-6"
                >
                  <dt className="mb-2 font-display text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--primary-strong)]">
                    {m.label}
                  </dt>
                  <dd className="text-sm leading-relaxed text-[color:var(--card-foreground)]">{m.value}</dd>
                </div>
              ))}
            </dl>

            {locations.length > 0 && (
              <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-x-12 gap-y-4">
                {locations.map((loc, i) => (
                  <li
                    key={i}
                    // Both locations describe markets covered, so they pair with
                    // the "markets" card. Keyed by meaning, not by position.
                    data-pair="markets"
                    className="text-center"
                  >
                    <span className="mb-1 block font-display text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--primary-strong)]">
                      {localize(loc.label, locale)}
                    </span>
                    <span className="text-sm text-[color:var(--card-foreground)]">{localize(loc.value, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AnimeScope>
      )}

      {/* The languages section stood here. Removed from display at the client's
          request; the rows, the /admin/expertise editor and open question q1 are
          all intact, so it can be restored once the levels are confirmed. */}
    </PageShell>
  )
}
