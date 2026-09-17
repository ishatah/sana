import { getLocale } from "next-intl/server"
import { localize, type LocalizedString } from "@/lib/localize"
/* The list scaffolding and its two scroll effects. A client component that takes
   the server-rendered phrases as children, see the note at the call site. */
import { MarkRail } from "@/components/motion/fm/mark-rail"

/**
 * The areas of expertise, as a numbered editorial list.
 *
 * ── WHY THERE ARE NO ICONS ANY MORE ────────────────────────────────────────────
 *
 * This was a three-column grid of bordered panels, each with a lucide icon: a
 * handshake for partnerships, a globe for international work, users for community,
 * a heart for philanthropy. That mapping is the most predictable one available,
 * it is what you get by asking for "an icon for partnerships", and lucide's line
 * style is recognisable on sight as the default developer pick. Three problems:
 *
 *   1. THE ICONS CARRIED NO INFORMATION. Every one was `aria-hidden`, correctly,
 *      because the heading beside it already said the thing. A decorative glyph
 *      that restates the adjacent text in a vaguer form is not clarifying it.
 *   2. A HEART ON A CREDIBILITY PAGE. This is a formal professional profile;
 *      literal sentimental iconography works against the register the copy holds.
 *   3. THEY FORCED `tabIndex={0}` ON NON-INTERACTIVE ELEMENTS. The cells were made
 *      focusable purely so a hover effect could be reached by keyboard, which put
 *      seven stops in the tab order that do nothing when you arrive at them. That
 *      is a real accessibility cost paid for decoration, and it is gone with the
 *      hover effect that required it.
 *
 * Numbers replace them. A numbered list reads as an inventory someone compiled;
 * an icon grid reads as a template filled in. The numerals are also genuinely
 * useful, they make the set countable at a glance, and they are set at a size
 * that lets the numeral be seen, which is the one place on this page where type
 * is the ornament. (This leaned on the display serif before the site moved to a
 * single family; size now carries it alone.)
 *
 * ── WHY THERE IS A SECOND LINE NOW ─────────────────────────────────────────────
 *
 * This comment used to say there was no body copy to write, on the grounds that
 * intake section 5 asked for "short noun phrases, no sentences" and inventing a
 * sentence per area would be asserting things about her practice that nobody had
 * confirmed. The second half of that still holds absolutely. The first half was
 * too strong: the phrases are all section 5 supplied, but they are not all the
 * DOCUMENT supplied. Section 1's نبذة شخصية خام bullets and the four-part profile
 * in data/biography.json describe the same eight areas at length, in her own
 * words, already approved for publication.
 *
 * So `detail` carries a sentence per area and every one of them is sourced from
 * that material, not authored here, see data/expertise.json `_comment_detail` for
 * which passage feeds which area. Nothing in it is a claim the supplied documents
 * do not already make, and section 3's ban on "أرقام ونِسب غير موثقة" is why no
 * detail carries a figure.
 *
 * `detail` IS OPTIONAL. An area without one renders as the phrase alone, exactly
 * as every area did before the field existed, so adding an area at /admin never
 * produces a half-built cell.
 *
 * NOTE ON `icon`: the field is still accepted in the item type because
 * data/expertise.json and the /admin editor both still carry it. It is simply not
 * rendered. Removing it from the data is a separate change to the admin schema,
 * and leaving an unused field is cheaper than a migration that has to be
 * coordinated with the client's editing session.
 */
export async function ExpertiseGrid({
  items,
}: {
  items: { id: string; icon?: string; title: LocalizedString; detail?: LocalizedString }[]
}) {
  const locale = await getLocale()

  return (
    /*
     * A <ul>, NOT AN <ol>, AND THE CHANGE OF ELEMENT IS THE POINT.
     *
     * This was an ordered list whose numerals, 01 through 07, were drawn
     * explicitly beside each phrase. The justification was that the numbers were
     * content rather than ornament, so the element should say so.
     *
     * But nothing here is ordered. These are competences; "Business development"
     * is not the first of anything, it is whatever row the CMS returned first, and
     * an editor reordering them in the admin would silently renumber a ranking
     * that was never a ranking. An <ol> makes a promise about sequence to every
     * screen reader that meets it, and this list cannot keep it.
     *
     * So the numerals are gone and the element is honest: a set of seven things,
     * announced as "list, 7 items", with no position asserted for any of them.
     *
     * FOUR COLUMNS AT `lg`, AND THE ITEM COUNT IS WHY IT WORKS.
     *
     * The list was held at two columns because three columns of a two-word phrase
     * left each cell mostly empty and produced a ragged trailing gap. As cards
     * that constraint inverts: a card has its own edges, so a cell is never
     * "mostly empty", it is a panel, and the question becomes whether the rows
     * FILL.
     *
     * There are eight areas, and eight divides evenly by one, two and four. So
     * 1 / 2 / 4 is the one ladder with no orphan row at any breakpoint. Three
     * columns would leave a two-card remainder, which is exactly the ragged gap
     * the old comment described fighting.
     *
     * `gap-6` rather than the old `gap-x-16`: four rem of air between columns
     * existed because the rows were text with no boundary of their own. Bordered
     * panels define their own edges and need less space between them.
     */
    /*
     * `.mark-wall` supplies the gutter measure the row rule offsets by
     * (styles/globals.css). The decorative gutter strokes it used to hang beside
     * each row are gone.
     */
    /*
     * `MarkRail` is a client wrapper that renders the <ul> and each <li>, and
     * takes the phrases below as children. What it owns is decoration: the whole
     * list shears very slightly with scroll velocity. See
     * components/motion/fm/mark-rail.tsx.
     *
     * THE PHRASES STILL RENDER ON THE SERVER. Only the list scaffolding crosses
     * the boundary; every `localize()` call below runs once, here, as it did
     * before. That is the same arrangement the hero uses for its portrait and
     * role line.
     */
    /*
     * ── THE ATMOSPHERE CLASSES ON THIS WALL ─────────────────────────────────────
     *
     * Four opt-ins, each one a single class, each documented at its rule in
     * styles/globals.css. They add no JavaScript: every one of them reads the
     * document light that components/motion/fm/atmosphere.tsx already publishes.
     *
     *   `lit-wall`   #1 + #6 + #10, the bloom on each card is re-pointed at the
     *                DOCUMENT light rather than at the pointer's position within
     *                that card, so eight cards stop being eight independent lamps
     *                and become one lit scene with real falloff across the grid.
     *                Also moves the shadow opposite the light, and spills a faint
     *                bloom onto the neighbours of a hovered card.
     *   `flare`      #26, the anamorphic streak, gated on each card's own tilt.
     *   `backlit`    #8, a warm gradient BEHIND the wall that drifts with the
     *                weather. The cards are `backdrop-filter` surfaces, so they
     *                sample it for free; this is the clearest case for why the
     *                light is global.
     *   `depth-stage` #23, was already here and had no rule; it now means the
     *                band's perspective breathes with scroll speed.
     */
    <MarkRail className="depth-stage lit-wall flare backlit mark-wall expertise-card-wall recede-group grid-breath grid list-none sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        /* Left at the body weight rather than given a heading weight. Nothing in
           this row competes with the phrase now that the figure is gone, so the
           phrase is simply set for reading rather than being balanced against an
           ornament. */
        /*
         * EFFECT 23, the cell tints to --primary-soft on hover.
         *
         * IT IS THE TINT ONLY, AND EFFECT 27 (cursor spotlight) IS NOT ADDED.
         * The `lit-wall` class above already re-points every card's bloom at the
         * DOCUMENT light, and its note explains the whole purpose of that: so
         * that eight cards "stop being eight independent lamps and become one
         * lit scene". A cursor-following radial per card is precisely the
         * independent-lamp behaviour that system replaced, adding it here would
         * reinstate the problem `lit-wall` exists to solve, with the two lights
         * disagreeing about where the light source is.
         *
         * The tint does not conflict, because it writes background-color while
         * the lit-wall bloom writes a background-image gradient. Different
         * properties, one element, no contest.
         *
         * --primary-soft composites to about #1e1b14 over the ground, where
         * --heading measures 15.2:1, so the phrase stays well clear of AA
         * through the tint.
         */
        /*
         * THE TINT MOVES TO THE WRAPPER, NOT THE HEADING. `cell-tint` fills the
         * cell on hover, so it has to sit on the element that IS the cell. With
         * a detail line below it, the <h3> is no longer that element, and
         * leaving the class there would tint the phrase's own box while the
         * sentence beneath it stayed on the untinted ground.
         *
         * `MarkRail` renders the <li>; this div is the cell's content box.
         */
        <div key={item.id} className="cell-tint">
          <h3 className="text-base font-medium leading-snug text-[color:var(--heading)]">
            {localize(item.title, locale)}
          </h3>
          {item.detail && (
            /* Muted, one step down from the phrase. The phrase is the area; this
               says what the area consists of, and must not compete with it. */
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
              {localize(item.detail, locale)}
            </p>
          )}
        </div>
      ))}
    </MarkRail>
  )
}
