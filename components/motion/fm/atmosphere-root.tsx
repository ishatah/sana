"use client"

import { Atmosphere } from "./atmosphere"
import { PagePhysics } from "./page-physics"
import { FmRoot } from "./fm-root"

/**
 * The one mount point for the document-wide atmosphere.
 *
 * ── IT IS A LEAF, AND THAT IS WHAT LETS IT SIT IN THE LAYOUT ──────────────────
 *
 * app/[locale]/layout.tsx records why `MotionProvider` was removed from the top of
 * every page: a client component wrapping `{children}` drags the whole page tree
 * across the boundary, and every route then pays for the runtime whether or not it
 * animates anything.
 *
 * This is the same shape as `ReadingRail`, which that file already permits on
 * exactly this reasoning: a SELF-CLOSING SIBLING with no children. Its client
 * bundle is itself; every section below it stays a server component. A wrapper's
 * cost is its subtree, a leaf's cost is itself.
 *
 * ── AND WHY ALL THREE ARE IN ONE COMPONENT ────────────────────────────────────
 *
 * The two overlays and the two publishers are one system: the grain reads
 * `--scroll-speed`, the vignette reads `--light-x`, and neither renders anything
 * meaningful without its publisher mounted. Splitting them into four call sites in
 * the layout would make it possible to mount an overlay whose driver is absent,
 * a fixed full-viewport layer painting a constant, which is the one failure mode
 * here that costs something and shows nothing.
 *
 * ── THE OVERLAY ORDER IS DELIBERATE ───────────────────────────────────────────
 *
 * Vignette (z 55) under aberration (56) under grain (60). Grain is a texture and
 * must sit on top of everything it textures, including the other two effects,
 * film grain that sits UNDER a lens artefact reads as two separate overlays rather
 * than as one photographic process.
 *
 * All three are `pointer-events: none` in the stylesheet. That is load-bearing
 * rather than tidy: a fixed layer across the viewport without it swallows every
 * click on the site, which is the classic way a decorative overlay takes a page
 * down.
 */
export function AtmosphereRoot() {
  return (
    <FmRoot>
      <Atmosphere />
      <PagePhysics />

      {/*
        `aria-hidden` on all three, and none is focusable or in the accessibility
        tree. They are texture over content that is already complete and readable;
        a screen reader must never encounter them.
      */}
      <div className="page-vignette" aria-hidden="true" />
      <div className="page-aberration" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />

      {/*
        ── #17, THE INK-BLEED FILTER ──────────────────────────────────────────

        The SVG filter `.ink-rule` references. It lives here, once, for the reason
        an SVG filter always has to: `filter: url(#id)` resolves against the
        DOCUMENT, so the definition must exist somewhere in the page, but only
        once, no matter how many rules use it.

        `feTurbulence` + `feDisplacementMap` is what makes a rule read as ink in
        paper rather than as a blurred line: a blur softens an edge uniformly,
        while a displacement makes it VARY, which is what absorption into a fibre
        actually looks like.

        The <svg> is zero-sized and `aria-hidden`: it paints nothing itself and is
        purely a definition carrier.
      */}
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
        <defs>
          <filter id="ink-bleed" x="-10%" y="-200%" width="120%" height="500%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 0.4" numOctaves="2" seed="7" result="noise" />
            {/* 1.4 is the ceiling. Above roughly 2 the rule stops reading as a
                rule and starts reading as a rendering artefact. */}
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
    </FmRoot>
  )
}
