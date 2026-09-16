/**
 * The decorative layer, one entry per section.
 *
 * ALL SVG HAS BEEN REMOVED FROM THIS FILE. Every section object used to be drawn
 * geometry: a wireframe globe, concentric rings, a hexagonal lattice, a vertical
 * thread, a medallion bezel, great-circle arcs, plus the hero's bled meridians and
 * an feTurbulence grain tile. None of it is drawn any more.
 *
 * The exported names are unchanged, so no call site had to move. What each one
 * renders now is either nothing at all, or, where the object was load-bearing for
 * layout rather than ornament, a plain CSS ground built from gradients and
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
 * HERO / ABOUT figure fill, nothing.
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

/** EXPERTISE, was a hexagonal lattice. */
export function ExpertiseLattice() {
  return null
}

/** POSITIONS, was a vertical thread with a travelling pulse. The `.timeline` rail
 *  on the list itself already carries that language, so nothing is lost. */
export function PositionsThread() {
  return null
}

/** RECOGNITION / MEMBERSHIPS, was a medallion outline. */
export function RecognitionMedallion() {
  return null
}

/** CONTACT, was a set of great-circle arcs. */
export function ContactArcs() {
  return null
}

/**
 * HERO, the section backdrop.
 *
 * THE ONLY OBJECT THAT STILL PAINTS, because it is not ornament: it is the hero's
 * ground. Without it the band is a flat rectangle of charcoal with a photograph
 * dropped on it, and a long shallow gradient on an 8-bit display bands visibly.
 *
 * IT IS NOW PURE CSS, AND IT IS ENTIRELY BLACK. The meridian linework and the SVG
 * grain tile are gone, and so are the two tinted passes (see the note in the body).
 * What remains is three gradient passes, none of which is vector geometry and none
 * of which adds colour, they only subtract light:
 *
 *   1. THE VIGNETTE, in two passes. One ellipse is the wrong shape, a single
 *      radial sized to the band gives an oval of light with visibly curved top and
 *      bottom edges, which reads as a spotlight. The first pass is wider than tall
 *      so its falloff runs mostly left-to-right; the second is a straight vertical
 *      ramp that seats the top and bottom. Together they darken all four edges with
 *      none of them curving.
 *
 *   2. A FINAL CORNER VIGNETTE over the top of those, pushing the eye back toward
 *      the centre of the band.
 *
 * THE BAND CARRIES NO TINT OF ITS OWN. Every stop here is black-alpha over
 * `--background`, so the hero's ground is the same charcoal as every other section
 * on the page, only shaped at its edges.
 *
 * Nothing here moves. A pulsing background behind a headline is the one thing in
 * this vocabulary that would be impossible to read past.
 */
export function HeroBackdrop() {
  return (
    <ObjectLayer className="hero-backdrop">
      {/* Pass 1, the horizontal falloff. 120% wide by 78% tall, so the bright
          area is a broad band rather than a circle. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 78% at 50% 42%, transparent 35%, rgba(0, 0, 0, 0.32) 78%, rgba(0, 0, 0, 0.55) 100%)",
        }}
      />
      {/* Pass 2, the top and bottom seats. Straight-line falloff, so it cannot
          contribute any curvature of its own. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0, 0, 0, 0.42), transparent 22%, transparent 74%, rgba(0, 0, 0, 0.5))",
        }}
      />
      {/*
        PASSES 3 AND 4 ARE GONE, the off-axis warm wash and the cool corner lift.

        Both were off-centre radials over a near-black ground, and both failed the
        same way the aurora and the bloom did in components/hero.tsx: an isolated
        radial on near-black does not read as a room being lit, it reads as a
        glowing circle sitting on the page, because there is no lit surface around
        it for the falloff to be measured against. The warm one was the louder of
        the two, a gold disc off to the right of the headline.

        Removing them costs nothing this band needs. The vignette below still gives
        it edges, the top-and-bottom seats still give it a floor and a ceiling, and
        the portrait is still separated from the ground by its own treatment. The
        band is now flat charcoal shaped only by black, which is what every other
        band on the page already is.
      */}
      {/*
        PASSES 5 AND 6 ARE GONE, the concentric arcs and the hairline column rules.

        Both were drawn as repeating gradients rather than vectors, and both were
        argued for on the same ground: that a large dark area needs texture or it
        "reads as an empty void at desktop size".

        That argument is wrong here, and the portrait is why. This band is not an
        empty dark area, it holds a cut-out photograph of a person lit from the
        left, and it is the only photograph on the page. Concentric rings struck
        from a point behind her head are precisely the decoration that competes
        with a portrait: the eye follows the arcs outward from exactly the place
        the subject's face already occupies.

        They also failed the only test that matters for ornament, remove it and
        see what is lost. Nothing is: the vignette still gives the band edges, the
        warm wash still separates her from the ground, and the horizon still gives
        it a floor. What is gone is a ring pattern and a set of vertical rules that
        no one would have asked for.

        What remains in this component is all grounding rather than ornament: the
        black passes that shape how the band is edged.
      */}

      {/*
        Pass 3, the corner vignette. Darkens the four corners so the band has edges
        and the eye is pushed back toward the centre. Last, because a vignette has
        to sit over the passes it is darkening.
      */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(115% 95% at 50% 45%, transparent 55%, rgba(0, 0, 0, 0.55) 100%)",
        }}
      />

    </ObjectLayer>
  )
}
