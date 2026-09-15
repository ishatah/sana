import { Reveal } from "@/components/motion/reveal"
/* The mask sweep, used when `maskReveal` is set. A client component; the heading
   text is passed through as children and is never split or inspected. */
import { MaskHeading } from "@/components/motion/fm/mask-heading"

/**
 * A section heading: an <h2> over a rule, in one of two alignments.
 *
 * THE DEFAULT IS NOW `start`, NOT CENTRE, and that is the point of this component
 * having an `align` prop at all.
 *
 * Every section on the site used to render this centred, which produced seven
 * identical centred bands stacked down the page, heading, rule, content, repeat.
 * That uniform vertical rhythm is the single most recognisable signature of a
 * generated page: nothing in the layout responds to what the section actually
 * contains.
 *
 * It was also a straightforward mismatch. The Positions and Recognition sections
 * are LISTS, left-aligned rows of organisation names and dates. A centred heading
 * over a left-aligned list has no shared edge with the thing it labels, and the eye
 * has to travel back to the start of the line to begin reading.
 *
 * So: `start` for sections whose content is a list or a prose column (the majority),
 * `center` kept for the genuinely symmetrical ones, the contact block and the
 * legal pages, where the content is itself centred and the heading agrees with it.
 * The choice is per-section and deliberate rather than global.
 *
 * `animate` opts the heading into the anime.js word-reveal by tagging it
 * `data-anime="heading"`. The decorative divider that used to sit under every
 * heading is gone, so the heading and its lede are all there is to animate.
 * It is opt-in rather than automatic because the home page deliberately has no
 * anime.js layer, the same component serves both, and only the dedicated pages
 * pass the flag.
 *
 * IT IS SAFE TO TAG THIS PARTICULAR ELEMENT. `title` is always a translated UI
 * string from messages/*.json, never an organisation's legal name, those render
 * through RoleEntryList, which has no splitting anywhere near
 * them. Splitting a legal name into per-word spans would break the intake form's
 * requirement that it be rendered verbatim and intact.
 */
export function SectionHeader({
  title,
  subtitle,
  id,
  animate = false,
  maskReveal = false,
  align = "start",
  number,
}: {
  title: string
  subtitle?: string
  id?: string
  animate?: boolean
  /**
   * Uncover the heading with a sweeping mask instead of fading it in.
   *
   * Mutually exclusive with `animate`, see the note at the <h2> below. Opt-in
   * rather than automatic, because the mask costs a client boundary per heading
   * and the legal pages have no reason to pay for one.
   */
  maskReveal?: boolean
  align?: "start" | "center"
  /**
   * A section ordinal, "01", "02", set beside the heading in the same gold
   * display face as the expertise wall.
   *
   * A STRING, PASSED BY THE CALLER RATHER THAN DERIVED. A count kept here would
   * count headings that RENDERED, and `getSectionAvailability()` gates whole
   * sections off when their data has not arrived, so the numbers would silently
   * change meaning as the intake form is answered. The caller knows which sections
   * exist on its own page and is the only place that can number them honestly.
   *
   * `aria-hidden`: a screen reader moving by heading already has the document
   * outline, so announcing "zero one" before every heading is noise.
   */
  number?: string
}) {
  const centered = align === "center"

  /*
   * WHEN THE ANIME LAYER OWNS THIS HEADING, `Reveal` MUST NOT ALSO GATE IT.
   *
   * `Reveal` starts at `opacity: 0` and waits for an IntersectionObserver at a 12%
   * threshold to add `.is-visible`. That is the correct floor for a heading nothing
   * else animates. But inside a full-viewport `MotionScope` section it becomes a
   * second, competing gate on the same element, and it is the one that fails:
   *
   * measured on /en, every `animate` heading sat at `opacity: 0` with
   * `translateY(24px)` while its own `data-anime` children had already animated to
   * `opacity: 1` inline. The recipe ran; the wrapper never got its class, so the
   * wrapper hid content the recipe had already revealed. A section-tall wrapper
   * that the page scrolls past in one animated jump can miss its 12% crossing
   * entirely, which is the same class of trigger failure `ensureVisible` exists for
   *, except here there is no anime.js instance on the WRAPPER for a guard to play.
   *
   * So when `animate` is set, this renders a plain element: the recipe is
   * responsible for the entrance, `ensureVisible` is responsible for guaranteeing
   * it, and the CSS `prefers-reduced-motion` block already forces `[data-anime]`
   * visible. When `animate` is not set, the legal pages, any un-scoped section,
   * `Reveal` remains exactly as it was.
   */
  const Wrapper = animate ? "div" : Reveal

  /*
   * EFFECT 2, THE LAST WORD IN GOLD.
   *
   * CSS cannot address "the last word", so the split happens here. It is safe on
   * this particular string for the same reason the `data-anime` hook above is
   * safe, and the reasoning is worth repeating rather than cross-referencing:
   * `title` is always a translated UI string from messages/*.json, never an
   * organisation's legal name. Those render through RoleEntryList, which does no
   * splitting anywhere near them, because the intake form requires a legal name
   * be rendered verbatim and intact.
   *
   * THE SPLIT IS ON THE LAST SPACE, WHICH IS NOT THE SAME AS THE LAST WORD in
   * every script this site renders. Arabic is cursive and joins WITHIN a word,
   * but it still separates words with U+0020, so slicing at the final space
   * never lands inside a joined run, and the two halves each stay a complete
   * word. That is what makes this safe in both locales where colouring a
   * per-LETTER slice would not be (see the drop-cap note in globals.css, which
   * cancels itself under RTL for exactly that reason).
   *
   * A single-word title is left whole rather than being coloured entirely gold:
   * a fully gold heading is a different effect from an accented one, and it
   * would spend the accent budget on every short heading on the site.
   */
  const cut = typeof title === "string" ? title.trimEnd().lastIndexOf(" ") : -1
  const headingContent =
    cut > 0 && typeof title === "string" ? (
      <>
        {title.slice(0, cut)}{" "}
        <span className="accent-word">{title.slice(cut + 1)}</span>
      </>
    ) : (
      title
    )

  return (
    <Wrapper className={centered ? "text-center" : ""}>
      {/*
        THE HEADING STANDS ALONE, and it used to have a figure beside it.

        Each band on the home page carried a section ordinal, 01 through 05, set
        on the heading's baseline in gold display type. The counter that produced
        them lived in app/[locale]/page.tsx and incremented in render order
        specifically so that a section gated off by missing intake data would not
        leave a hole in the sequence.

        That machinery was careful and it was solving a problem the numbers
        created. A table of contents is for a document you cannot see the whole of;
        this is one page, with five bands, and a nav that already lists them by
        name. Numbering them told the reader what section they were in, which the
        heading directly above the number was already saying, in words, in their
        own language.

        With the figure gone the row collapses to the <h2> itself. `mb-5` moves
        back onto the heading now that there is no baseline-aligned flex row whose
        margin would have sat inside the heading's box and pushed the row's
        baseline 20px below the glyphs.
      */}
      {/*
        TWO WAYS THIS HEADING CAN ARRIVE, AND THEY ARE MUTUALLY EXCLUSIVE.

        `animate` tags it `data-anime="heading"` for the vanilla entrance recipes
        in components/motion/sections.ts, opacity and a short rise.

        `maskReveal` hands it to components/motion/fm/mask-heading.tsx instead,
        where a band of light uncovers the type from its reading edge.

        NEVER BOTH. Two systems would be animating one element, which is the
        failure the ownership rule in components/motion/fm/variants.ts exists to
        prevent, and here they would be fighting over whether the heading is
        visible, which is the worst thing to be uncertain about. The branch below
        makes it impossible to set both: `maskReveal` wins and the `data-anime`
        hook is not written, so the recipe never finds the element.

        IT IS SAFE TO MASK THIS PARTICULAR ELEMENT for the same reason it is safe
        to tag it: `title` is always a translated UI string from messages/*.json,
        never an organisation's legal name and never the subject's own name. The
        hero <h1> takes neither hook, see components/hero.tsx.
      */}
      {/*
        THE ACCENT SPLIT GOES ONLY ON THE PLAIN BRANCH, and that asymmetry is
        deliberate rather than an omission.

        MaskHeading sweeps a band of light across the whole element and its own
        note says the text is "passed through as children and is never split or
        inspected". Handing it a fragment containing a coloured <span> would put
        a second colour under a mask that was written to uncover one, the gold
        word would be revealed at a different apparent moment from the rest of
        the line, because the mask travels across it rather than over it.

        So the masked branch keeps the plain string and takes effect 29
        (.reveal-warm) instead, which is the sweep's own colour treatment: it
        uncovers warm and settles to --heading. The two effects do the same job
        by different means, and each heading gets exactly one of them.
      */}
      {maskReveal ? (
        <MaskHeading id={id} className="section-heading reveal-warm mb-10">
          {title}
        </MaskHeading>
      ) : (
        <h2
          id={id}
          className="section-heading mb-10"
          {...(animate ? { "data-anime": "heading" } : {})}
        >
          {headingContent}
        </h2>
      )}

      {subtitle && (
        <p
          /* Effect 9: starts at --muted-foreground and settles to --foreground.
             The dimmed state is itself an AA-passing colour (5.00:1 worst case),
             so a reader whose observer never fires still gets legible copy
             rather than an invisible paragraph, which is the property that
             makes a colour-based reveal safe where an opacity-based one would
             not be. The class sets its own colour, so the literal is dropped. */
          className={`prose-reveal -mt-6 mb-10 max-w-2xl ${centered ? "mx-auto" : ""}`}
          {...(animate ? { "data-anime": "lede" } : {})}
        >
          {subtitle}
        </p>
      )}
    </Wrapper>
  )
}
