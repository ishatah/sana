/**
 * The decorative layer — one entry per section.
 *
 * ALL SVG HAS BEEN REMOVED FROM THIS FILE. Every section object used to be drawn
 * geometry: a wireframe globe, concentric rings, a hexagonal lattice, a vertical
 * thread, a medallion bezel, great-circle arcs, plus the hero's bled meridians and
 * an feTurbulence grain tile. None of it is drawn any more.
 *
 * The exported names are unchanged, so no call site had to move. What each one
 * renders now is either nothing at all, or — where the object was load-bearing for
 * layout rather than ornament — a plain CSS ground built from gradients and
 * borders, which paints no vector geometry.
 *
 * WHY THE EXPORTS SURVIVE RATHER THAN THE IMPORTS BEING DELETED. `SectionFigure`
 * takes the object as `children` and uses its presence as the empty-slot state for
 * a media slot that is still unfilled; `HeroBackdrop` still owns the hero's ground.
 * Keeping the seams means a future decision about those slots is a change here
 * rather than across six files.
 *
 * EVERYTHING HERE IS STILL `aria-hidden` AND NON-INTERACTIVE. `.section-object`
 * clears pointer events so no layer can intercept a click.
 */

/** Shared wrapper. `overflow-hidden` on `.section-object` keeps a layer from
 *  widening the page, which would break the `overflow-x: hidden` contract. */
function ObjectLayer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-hidden className={`section-object ${className}`}>
      {children}
    </div>
  )
}

/**
 * HERO / ABOUT figure fill — nothing.
 *
 * These two were the wireframe globe and the counter-rotating rings, both of which
 * sat inside a bounded portrait frame. With the drawing gone the frame stands on
 * its own: `SectionFigure` already renders a ruled border and a `--surface` ground
 * for an empty slot, which is a deliberate empty state rather than a blank.
 */
export function HeroGlobe(_: { inset?: boolean }) {
  return null
}

export function AboutRings() {
  return null
}

/** EXPERTISE — was a hexagonal lattice. */
export function ExpertiseLattice() {
  return null
}

/** POSITIONS — was a vertical thread with a travelling pulse. The `.timeline` rail
 *  on the list itself already carries that language, so nothing is lost. */
export function PositionsThread() {
  return null
}

/** RECOGNITION / MEMBERSHIPS — was a medallion outline. */
export function RecognitionMedallion() {
  return null
}

/** CONTACT — was a set of great-circle arcs. */
export function ContactArcs() {
  return null
}

/**
 * HERO — the section backdrop.
 *
 * THE ONLY OBJECT THAT STILL PAINTS, because it is not ornament: it is the hero's
 * ground. Without it the band is a flat rectangle of charcoal with a photograph
 * dropped on it, and a long shallow gradient on an 8-bit display bands visibly.
 *
 * IT IS NOW PURE CSS. The meridian linework and the SVG grain tile are gone; what
 * remains is four gradient passes, none of which is vector geometry:
 *
 *   1. THE VIGNETTE, in two passes. One ellipse is the wrong shape — a single
 *      radial sized to the band gives an oval of light with visibly curved top and
 *      bottom edges, which reads as a spotlight. The first pass is wider than tall
 *      so its falloff runs mostly left-to-right; the second is a straight vertical
 *      ramp that seats the top and bottom. Together they darken all four edges with
 *      none of them curving.
 *
 *   2. A WARM WASH ANCHORED TO THE PORTRAIT SIDE, not the centre. An ellipse at
 *      roughly 78% across reads as light falling across the band rather than as a
 *      vignette applied to it, and it puts the brightest ground behind the
 *      portrait, which is where a photograph wants its separation. Under RTL the
 *      whole layer is mirrored (`.hero-backdrop` in styles/globals.css) so the
 *      light stays with the portrait, which has itself swapped sides.
 *
 *   3. A WIDER, COOLER PASS lifting the lower-left corner just enough that the band
 *      does not read as a rectangle of flat charcoal.
 *
 *   4. ONE HAIRLINE HORIZON at the optical baseline of the text block, carrying the
 *      accent at the low alpha the rest of the page uses. It gives the band a floor
 *      without drawing a box around anything. Inline gradient rather than a border
 *      so it can fade at both ends; a hard-stopped rule would read as an underline
 *      for whatever sat above it.
 *
 * Nothing here moves. A pulsing background behind a headline is the one thing in
 * this vocabulary that would be impossible to read past.
 */
export function HeroBackdrop() {
  return (
    <ObjectLayer className="hero-backdrop">
      {/* Pass 1 — the horizontal falloff. 120% wide by 78% tall, so the bright
          area is a broad band rather than a circle. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 78% at 50% 42%, transparent 35%, rgba(0, 0, 0, 0.32) 78%, rgba(0, 0, 0, 0.55) 100%)",
        }}
      />
      {/* Pass 2 — the top and bottom seats. Straight-line falloff, so it cannot
          contribute any curvature of its own. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0, 0, 0, 0.42), transparent 22%, transparent 74%, rgba(0, 0, 0, 0.5))",
        }}
      />
      {/* Pass 3 — the off-axis warm wash. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 70% at 78% 38%, rgba(var(--primary-rgb), 0.06), transparent 70%)",
        }}
      />
      {/* Pass 4 — the cool corner lift. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 90% at 8% 92%, rgba(255, 255, 255, 0.035), transparent 65%)",
        }}
      />
      {/*
        Pass 5 — THE ARCHITECTURE. Concentric arcs struck from a centre behind the
        portrait, so the geometry radiates from where the light already is instead
        of being a pattern laid over the whole band.

        DRAWN AS A REPEATING RADIAL GRADIENT rather than as stroked vector ellipses,
        which is what this layer was until all drawn geometry was removed from the
        app. The gradient produces the same thing — hard, thin rings struck from one
        off-centre point — because each `transparent -> colour -> transparent` stop
        pair IS a ring, and repeating the stop set is what makes them concentric.

        HOW THE STOPS MAP BACK TO THE ORIGINAL. The rings ran at radii 26-58 in a
        100-unit box, i.e. one every 8 units, so the repeat period is 8%. Each was
        0.09 units of stroke, which is why the coloured band inside the period is a
        fraction of a percent wide rather than a visible ribbon.

        `ellipse ... at 72% 40%` keeps the centre where it was, and the ellipse
        sizing does the job the old `preserveAspectRatio="none"` did: the rings
        stretch with the band and read as wide ellipses rather than as a circle
        floating in the middle.

        Stroked at ~0.5% alpha, as before. That is low enough that on a phone or a
        dim screen it is invisible, and that is intended rather than a compromise:
        its whole job is to keep a very large dark area from reading as an empty
        void at desktop size. Anything strong enough to notice would compete with
        the headline, which is the failure the old full-section globe had.

        The mask fades the rings out before the band's edges, which is what a finite
        set of five rings did by simply stopping at r=58.
      */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-radial-gradient(ellipse 34% 26% at 72% 40%, transparent 0 7.6%, rgba(var(--primary-rgb), 0.055) 7.6% 7.9%, transparent 7.9% 8%)",
          maskImage: "radial-gradient(ellipse 62% 58% at 72% 40%, #000 30%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse 62% 58% at 72% 40%, #000 30%, transparent 78%)",
        }}
      />

      {/*
        Pass 6 — THE HAIRLINE GRID, and it is deliberately not a full grid.
        
        A regular grid across the whole hero is the default "technical" backdrop and
        says software product — the wrong register, and the reason an earlier 96px
        grid was removed from this component entirely. What is here instead is a set
        of VERTICAL rules only, fading out before they reach the top or bottom, which
        reads as a ruled page or a column structure rather than as graph paper.

        1.5% white is below the threshold at which it reads as lines; it reads as
        the ground having a texture.
      */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 132px)",
          maskImage: "linear-gradient(to bottom, transparent, #000 30%, #000 62%, transparent 92%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 30%, #000 62%, transparent 92%)",
        }}
      />

      {/*
        Pass 7 — the vignette. Darkens the four corners so the band has edges and
        the eye is pushed back toward the centre. It is the last pass because it
        must sit over the geometry above: arcs running bright into the corner would
        undo exactly what this is for.
      */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(115% 95% at 50% 45%, transparent 55%, rgba(0, 0, 0, 0.55) 100%)",
        }}
      />

      {/* The horizon. */}
      <div
        className="absolute inset-x-0 bottom-[14%] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(var(--primary-rgb), 0.22) 30%, rgba(var(--primary-rgb), 0.10) 70%, transparent)",
        }}
      />
    </ObjectLayer>
  )
}
