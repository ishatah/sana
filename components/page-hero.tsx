import { Reveal } from "@/components/motion/reveal"
import { MotionScope } from "@/components/motion/motion-scope"
import { ScrollParallax } from "@/components/motion/fm/scroll-parallax"

/**
 * The opening band of a dedicated page.
 *
 * Deliberately NOT the home `Hero`. That one is a near-full-height band carrying
 * the name at display size, which is right for a landing page and wrong for a
 * document you arrived at on purpose, it would put a screen of masthead between
 * the visitor and the thing they clicked to read. This is compact: eyebrow, one
 * `h1`, an optional lede, and the same gold rule the section headings use, so the
 * two read as one system.
 *
 * THE POINTER-TRACKED GOLD WASH IS GONE. This used to render a radial gradient
 * whose centre followed the cursor (`interaction="heroPointer"`). Two reasons it
 * went, matching the home hero, which lost the same gradient:
 *
 *   - A soft radial glow is the default "make the header look designed" backdrop,
 *     and it is the kind of thing that reads as generated precisely because it is
 *     applied without reference to what the page is about.
 *   - Making it chase the cursor is decoration reacting to the pointer rather than
 *     to the reader. On a page of verified titles and dates, that is the wrong
 *     register, and it was invisible to anyone on a touch device or a keyboard
 *     anyway, since the interaction skipped coarse pointers entirely.
 *
 * The band is now flat ground and type, which is what the rest of the site is.
 *
 * LEFT-ALIGNED, not centred, the same correction `SectionHeader` carries. Every
 * page below this opens with a left-aligned heading over left-aligned content, so
 * a centred title at the top shared an edge with nothing beneath it.
 *
 * IT CARRIES THE PAGE'S ONLY `h1`. Each route needs exactly one, and every
 * `SectionHeader` below it renders an `h2`, so the outline stays well-formed.
 *
 * The top padding lives in the `.page-hero` rule in styles/globals.css rather
 * than here, so it clears the fixed header.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string
  title: string
  lede?: string
}) {
  return (
    <MotionScope as="section" recipe="bandHeading" className="page-hero">
      {/*
        ── THE PARALLAX WRAPS THE CONTAINER, IT DOES NOT TOUCH THE HOOKS ─────────

        The ownership rule in components/motion/fm/variants.ts forbids one element
        carrying both `data-anime` and `data-fm`, because ../motion/dom.ts composes
        a single `transform` string while Framer writes its own from MotionValues,
        whichever runs last on a frame wins, and the element visibly fights itself.

        `bandHeading` owns the eyebrow, the `h1`, the rule and the lede, all of
        which are INSIDE this wrapper. `ScrollParallax` renders its own nesting
        `<div>` pair and writes `data-fm` only on those, so the two systems animate
        different elements at different levels of the tree and never collide. The
        dev audit in components/motion/fm/audit.tsx asserts this holds.

        `depth={0.55}`, a content band is furniture rather than a masthead, so it
        carries roughly half the recession the home hero's portrait does. See the
        prop's note for why the ranges scale together rather than being retuned.
      */}
      <ScrollParallax className="container-page" depth={0.55}>
        <Reveal>
          {/* Effect 4: the eyebrow gains a 40px gold hairline after the label.
              .eyebrow-rule only adds the ::after rule and the flex alignment it
              needs, the existing .eyebrow keeps its own colour and tracking, so
              the other call sites of .eyebrow are unaffected. The rule is
              decorative and is not the sole indicator of anything; the label
              beside it is the content. */}
          {eyebrow && <p className="eyebrow eyebrow-rule mb-3">{eyebrow}</p>}

          {/* `data-anime="heading"` opts this into the word-reveal. Safe here: the
              title is always a translated UI string, never an organisation name. */}
          <h1 className="page-hero-title" data-anime="heading">
            {title}
          </h1>

          {lede && (
            <p className="prose-reveal mt-6 max-w-2xl" data-anime="lede">
              {lede}
            </p>
          )}
        </Reveal>
      </ScrollParallax>
    </MotionScope>
  )
}
