import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { PageShell } from "@/components/page-shell"
import { PageHero } from "@/components/page-hero"
import { MotionScope } from "@/components/motion/motion-scope"
import { MassLag } from "@/components/motion/fm/mass-lag"
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
 * Nothing is described or characterised. The intake form asked for "short noun
 * phrases, no sentences" and that is what exists, so the grid carries phrases and
 * the markets section carries labelled facts, no invented prose elaborating on
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
        accessibility cost paid for decoration". That reasoning holds, seven tab
        stops that do nothing on arrival is a worse trade than a missing hover
        effect.

        Leaving the props would have been the quieter failure: anime.js finds no
        targets, logs a console warning, and the section simply never animates
        while the source still claims it does.

        The list is not left static, every row is inside a `Reveal`, which is the
        site's baseline entry animation.
      */}
      {/* `markWall` draws each margin mark out along the gutter as the list comes
          into view, then brings the phrases up behind them. The phrases never move
          horizontally, see the recipe's own note.

          There is no `interaction` here any more. The wall used to carry
          `countNumerals`, an rAF count-up on the ordinals; the ordinals are gone
          and the marks' entrance belongs to the recipe, so the scope needs only
          the one hook. */}
      <MotionScope
        as="section"
        id="expertise-areas"
        recipe="markWall"
        physics
        className="section-skew snap-section page-section"
      >
        <div className="container-page">
          <SectionHeader animate title={t("pages.expertise.areasHeading")} subtitle={t("expertise.subheading")} />
          <ExpertiseGrid items={expertise.items ?? []} />
        </div>
      </MotionScope>

      {(markets.length > 0 || locations.length > 0) && (
        <MotionScope
          as="section"
          id="expertise-markets" recipe="panelGrid"
          interaction="linkedPair"
          physics
          className="section-skew snap-section page-section page-section-alt"
        >
          <div className="container-page">
            <SectionHeader animate title={t("pages.expertise.marketsHeading")} />

            <dl className="depth-stage mx-auto grid max-w-3xl gap-8 sm:grid-cols-3">
              {markets.map((m, mi) => (
                /*
                 * THE PANELS HAVE MASS. `MassLag` at 1 is the reference weight,
                 * its own docblock names "a card, a panel, a figure" as exactly
                 * that, so a market panel is the canonical mass-1 object and
                 * takes the multiplier unchanged.
                 *
                 * IT WRAPS RATHER THAN BEING APPLIED TO THE PANEL, and that is
                 * the ownership rule in ../../motion/fm/variants.ts, not a
                 * preference. The panel already carries `data-anime="panel"`,
                 * which the `panelGrid` recipe animates by composing a single
                 * `transform` string. `MassLag` writes its own transform from a
                 * MotionValue. Two writers on one element means whichever ran
                 * last wins each frame and the panel visibly fights itself, so
                 * the lag goes on a parent node the recipe never touches.
                 */
                <MassLag key={m.label} mass={1}>
                {/*
                  THE FAN GETS ITS OWN NODE, and this wrapper exists for no other
                  reason.

                  Three writers want a transform on this panel and none of them
                  can share: the `panelGrid` recipe composes an inline
                  `transform` string on `[data-anime="panel"]`, `MassLag` writes
                  `y` from a MotionValue on its own `m.div`, and `fan-in` is a
                  CSS animation on `transform`. Any two on one element means
                  whichever wrote last wins each frame, the ownership rule in
                  ../../motion/fm/variants.ts, and the reason `MassLag` already
                  wraps rather than applies.

                  So the stack is one property per node, outermost to innermost:
                  MassLag's lag, then this fan, then the recipe's entrance.
                */}
                <div className="fan-in" data-ord={String(mi + 1)}>
                <div
                  data-anime="panel"
                  data-pair={m.pair}
                  // Focusable so the pairing highlight is reachable without a
                  // pointer, the interaction binds focusin alongside pointerenter.
                  tabIndex={0}
                  // `panel-edge-in` brings the border up after the fill, so the
                  // box assembles on entry rather than arriving finished. It
                  // animates border-color only, never width, which would shift
                  // the panel's content by a pixel as it ran.
                  className="panel-wipe card-ruled panel-3d panel-edge-in p-6"
                >
                  <dt className="mb-2 font-display text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--primary-strong)]">
                    {m.label}
                  </dt>
                  <dd className="text-sm leading-relaxed text-[color:var(--card-foreground)]">{m.value}</dd>
                </div>
                </div>
                </MassLag>
              ))}
            </dl>

            {locations.length > 0 && (
              <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-x-12 gap-y-4">
                {locations.map((loc, i) => (
                  /*
                   * THE LABELS ARE LIGHTER THAN THE PANELS, at 0.45 against the
                   * panels' 1.
                   *
                   * That ratio is the entire point of using one physics with a
                   * mass knob rather than two tuned effects: a caption lags less
                   * than a card BECAUSE IT WEIGHS LESS, not because a second
                   * file picked a smaller number. Read together, the panels
                   * settle a beat after the labels do, which is what makes the
                   * band read as one physical system.
                   *
                   * `MassLag`'s docblock names "a caption, an eyebrow, a rule"
                   * as the sub-1 cases; these two-line location labels are
                   * exactly that.
                   */
                  <li
                    key={i}
                    // Both locations describe markets covered, so they pair with
                    // the "markets" card. Keyed by meaning, not by position.
                    data-pair="markets"
                    className="text-center"
                  >
                  <MassLag mass={0.45}>
                    <span className="mb-1 block font-display text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--primary-strong)]">
                      {localize(loc.label, locale)}
                    </span>
                    <span className="text-sm text-[color:var(--card-foreground)]">{localize(loc.value, locale)}</span>
                  </MassLag>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </MotionScope>
      )}

    </PageShell>
  )
}
