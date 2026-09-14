import { getLocale } from "next-intl/server"
import { localize, type LocalizedString } from "@/lib/localize"

/**
 * The areas of expertise, as a numbered editorial list.
 *
 * ── WHY THERE ARE NO ICONS ANY MORE ────────────────────────────────────────────
 *
 * This was a three-column grid of bordered panels, each with a lucide icon: a
 * handshake for partnerships, a globe for international work, users for community,
 * a heart for philanthropy. That mapping is the most predictable one available —
 * it is what you get by asking for "an icon for partnerships" — and lucide's line
 * style is recognisable on sight as the default developer pick. Three problems:
 *
 *   1. THE ICONS CARRIED NO INFORMATION. Every one was `aria-hidden`, correctly,
 *      because the heading beside it already said the thing. A decorative glyph
 *      that restates the adjacent text in a vaguer form is not clarifying it.
 *   2. A HEART ON A CREDIBILITY PAGE. This is a formal professional profile;
 *      literal sentimental iconography works against the register the copy holds.
 *   3. THEY FORCED `tabIndex={0}` ON NON-INTERACTIVE ELEMENTS. The cells were made
 *      focusable purely so a hover effect could be reached by keyboard — which put
 *      seven stops in the tab order that do nothing when you arrive at them. That
 *      is a real accessibility cost paid for decoration, and it is gone with the
 *      hover effect that required it.
 *
 * Numbers replace them. A numbered list reads as an inventory someone compiled;
 * an icon grid reads as a template filled in. The numerals are also genuinely
 * useful — they make the set countable at a glance — and they are set in the
 * display serif at a size that lets it be seen, which is the one place on this
 * page where type is the ornament.
 *
 * Kyros pairs each panel with a paragraph of body copy. There is none to write
 * here: intake section 5 asks for "five to eight short noun phrases, no sentences"
 * and that is exactly what was supplied. Inventing a descriptive sentence per area
 * would be writing claims about her practice that nobody has confirmed, so each
 * row carries the phrase alone and is sized for it.
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
  items: { id: string; icon?: string; title: LocalizedString }[]
}) {
  const locale = await getLocale()

  return (
    /*
     * A real <ol>, because the numbers are now content rather than CSS ornament —
     * a screen reader announcing "list, 7 items" is the same information the
     * numerals give a sighted reader. `list-none` because the numerals are drawn
     * explicitly below; the browser's own marker would double them.
     *
     * TWO COLUMNS, NOT THREE. Three columns of a two-word phrase leaves each cell
     * mostly empty and produces the ragged trailing gap the old comment here
     * described fighting. At two columns the rows fill, and an odd item count
     * simply ends the list rather than leaving a hole in a grid.
     */
    /*
     * `.numeral-wall` hangs the figures outside the text column (styles/globals.css).
     * The numeral is no longer a flex sibling of the phrase — it is absolutely
     * positioned against the row — so the row is a plain block and the phrase
     * keeps the full measure.
     */
    <ol className="numeral-wall grid list-none gap-x-16 sm:grid-cols-2">
      {items.map((item, i) => (
        <li
          key={item.id}
          data-anime="panel"
          className="border-b border-[color:var(--border)] py-6"
        >
          {/*
            The numeral is `aria-hidden`: the <ol> already conveys ordinality to a
            screen reader, so reading it aloud would announce "one, one" on every
            row. Padded to two digits because 01–07 aligns on a common width and
            a bare "1" next to "7" does not.
          */}
          <span aria-hidden data-anime="numeral" className="numeral">
            {String(i + 1).padStart(2, "0")}
          </span>

          {/* Sans, not the display serif. The numeral is the display element in
              this row; setting the phrase in the serif too would leave the pair
              with no contrast and make the number read as a drop cap. */}
          <h3 className="text-base font-medium leading-snug text-[color:var(--heading)]">
            {localize(item.title, locale)}
          </h3>
        </li>
      ))}
    </ol>
  )
}
