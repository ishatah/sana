import { Reveal } from "@/components/motion/reveal"

/**
 * A section heading: an <h2> over a rule, in one of two alignments.
 *
 * THE DEFAULT IS NOW `start`, NOT CENTRE, and that is the point of this component
 * having an `align` prop at all.
 *
 * Every section on the site used to render this centred, which produced seven
 * identical centred bands stacked down the page — heading, rule, content, repeat.
 * That uniform vertical rhythm is the single most recognisable signature of a
 * generated page: nothing in the layout responds to what the section actually
 * contains.
 *
 * It was also a straightforward mismatch. The Positions and Recognition sections
 * are LISTS — left-aligned rows of organisation names and dates. A centred heading
 * over a left-aligned list has no shared edge with the thing it labels, and the eye
 * has to travel back to the start of the line to begin reading.
 *
 * So: `start` for sections whose content is a list or a prose column (the majority),
 * `center` kept for the genuinely symmetrical ones — the contact block and the
 * legal pages, where the content is itself centred and the heading agrees with it.
 * The choice is per-section and deliberate rather than global.
 *
 * `animate` opts the heading into the anime.js word-reveal by tagging it
 * `data-anime="heading"`. It used to swap the divider for a drawable SVG rule as
 * well; that SVG is gone and both branches now render the same `.space-border`.
 * It is opt-in rather than automatic because the home page deliberately has no
 * anime.js layer — the same component serves both, and only the dedicated pages
 * pass the flag.
 *
 * IT IS SAFE TO TAG THIS PARTICULAR ELEMENT. `title` is always a translated UI
 * string from messages/*.json, never an organisation's legal name — those render
 * through RoleEntryList, which has no splitting anywhere near
 * them. Splitting a legal name into per-word spans would break the intake form's
 * requirement that it be rendered verbatim and intact.
 */
export function SectionHeader({
  title,
  subtitle,
  id,
  animate = false,
  align = "start",
}: {
  title: string
  subtitle?: string
  id?: string
  animate?: boolean
  align?: "start" | "center"
}) {
  const centered = align === "center"

  /*
   * WHEN THE ANIME LAYER OWNS THIS HEADING, `Reveal` MUST NOT ALSO GATE IT.
   *
   * `Reveal` starts at `opacity: 0` and waits for an IntersectionObserver at a 12%
   * threshold to add `.is-visible`. That is the correct floor for a heading nothing
   * else animates. But inside a full-viewport `AnimeScope` section it becomes a
   * second, competing gate on the same element — and it is the one that fails:
   *
   * measured on /en, every `animate` heading sat at `opacity: 0` with
   * `translateY(24px)` while its own `data-anime` children had already animated to
   * `opacity: 1` inline. The recipe ran; the wrapper never got its class, so the
   * wrapper hid content the recipe had already revealed. A section-tall wrapper
   * that the page scrolls past in one animated jump can miss its 12% crossing
   * entirely, which is the same class of trigger failure `ensureVisible` exists for
   * — except here there is no anime.js instance on the WRAPPER for a guard to play.
   *
   * So when `animate` is set, this renders a plain element: the recipe is
   * responsible for the entrance, `ensureVisible` is responsible for guaranteeing
   * it, and the CSS `prefers-reduced-motion` block already forces `[data-anime]`
   * visible. When `animate` is not set — the legal pages, any un-scoped section —
   * `Reveal` remains exactly as it was.
   */
  const Wrapper = animate ? "div" : Reveal

  return (
    <Wrapper className={centered ? "text-center" : ""}>
      <h2 id={id} className="section-heading mb-5" {...(animate ? { "data-anime": "heading" } : {})}>
        {title}
      </h2>

      {/*
        The rule follows the heading's alignment rather than being centred
        unconditionally. `.space-border` and `.rule-draw` both centre themselves
        with `margin-inline: auto`, so the start-aligned case needs that undone —
        via `.rule-start` in styles/globals.css rather than Tailwind margin
        utilities, because `.space-border`'s flanking `::before`/`::after` rules
        have to be suppressed at the same time and a utility class cannot reach a
        pseudo-element.
      */}
      {/*
        ONE DIVIDER FOR BOTH BRANCHES, now that the SVG is gone.

        `animate` used to swap this for an inline <svg> whose path anime.js could
        draw on. Nothing has animated `data-anime="rule"` for some time — the
        drawable was already rendering as a static, fully-drawn line — so the two
        branches differed in markup and not in behaviour. Collapsing them to
        `.space-border` removes the last vector geometry here and loses nothing
        visible — it carries its own `margin-bottom: 40px`, which is the same
        40px the drawable rule got from `mb-10`, so the rhythm is unchanged.
      */}
      <div className={`space-border ${centered ? "" : "rule-start"}`} aria-hidden />

      {subtitle && (
        <p className={`-mt-4 mb-10 max-w-2xl text-[color:var(--foreground)] ${centered ? "mx-auto" : ""}`}>
          {subtitle}
        </p>
      )}
    </Wrapper>
  )
}
