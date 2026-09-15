"use client"

import { useRef, type ReactNode } from "react"
import { m, useScroll, useSpring, useTransform, useReducedMotion } from "motion/react"
import { FmRoot } from "./fm-root"
import { FM_READ_OFFSET, SCRUB_SPRING } from "./tokens"

/**
 * #43, READING-POSITION WEIGHT. A list that knows where you are in it.
 *
 * ── THIS IS WHAT SHOULD HAVE REPLACED THE GUTTER MARKS ────────────────────────
 *
 * ./mark-rail.tsx documents, at length, a feature that was built and then removed:
 * a gold stroke per row, scrubbed from nothing to full length as that row entered
 * the reading zone, un-drawing on the way back up. Its justification was the good
 * one, "the rail of marks becomes a reading indicator for the list, which is
 * information rather than decoration", and its removal note is honest about why
 * it went: the stroke itself was "decoration standing in for a bullet".
 *
 * Both things were true. The INFORMATION was worth having and the ORNAMENT
 * carrying it was not. So this puts the information back with no ornament at all:
 * the row nearest the reading zone is rendered fractionally brighter and larger,
 * and the rows away from it recede. Nothing is added to the page to say where you
 * are; the content itself says it.
 *
 * The scroll machinery this needs is the machinery that file already built and
 * then deleted along with the marks. This is that machinery, kept, driving the
 * content instead of a decoration.
 *
 * ── THE CEILINGS, AND WHY THEY ARE THIS LOW ───────────────────────────────────
 *
 * 1.012 scale and 0.62 opacity at the extremes. The same argument every constant
 * in this layer carries: at 1.05 and 0.3 you would SEE rows resizing, which reads
 * as a list reflowing under you and is actively unpleasant to read. At these
 * values nothing is seen to change, the row you are reading simply has a little
 * more presence than the ones you are not.
 *
 * ⚠️ `scale`, NEVER `font-size`. A font-size change reflows the row, which moves
 * every row below it, which changes their scroll positions, which changes their
 * scale, a feedback loop that makes the whole list jitter. `scale` is a
 * compositor-only transform and reflows nothing.
 *
 * ⚠️ AND OPACITY NEVER GOES BELOW 0.62. This is body content, not decoration.
 * A row faded further would be a readability regression for anyone scanning the
 * list rather than reading it top to bottom, and the whole point is that all of
 * it stays readable at all times.
 */

/** The scale at the reading zone, and the floor away from it. */
const SCALE_FOCUS = 1.012
const SCALE_AWAY = 0.994

/** Opacity at the reading zone, and the floor. Never below 0.62, see above. */
const OPACITY_FOCUS = 1
const OPACITY_AWAY = 0.62

export function ReadingFocus({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode
  className?: string
  as?: "div" | "li"
}) {
  const reduced = useReducedMotion()

  /*
   * Reduced motion renders the plain element: no Framer runtime, no scroll
   * subscription, no spring. The content is already complete and at full
   * opacity, which is the floor the stylesheet declares.
   */
  if (reduced) {
    return <Tag className={className}>{children}</Tag>
  }

  return (
    <FmRoot>
      <FocusRow className={className} as={Tag}>
        {children}
      </FocusRow>
    </FmRoot>
  )
}

function FocusRow({
  children,
  className,
  as: Tag,
}: {
  children: ReactNode
  className?: string
  as: "div" | "li"
}) {
  const ref = useRef<HTMLElement>(null)

  /*
   * `FM_READ_OFFSET`, the reading zone, biased upward, shared with the rest of this
   * layer so every effect frames the viewport identically. A row "counts" once it
   * enters the lower part of the viewport and is done by the upper middle.
   */
  const { scrollYProgress } = useScroll({ target: ref, offset: FM_READ_OFFSET })
  const smooth = useSpring(scrollYProgress, SCRUB_SPRING)

  /*
   * A TRIANGLE, NOT A RAMP. Progress runs 0 -> 1 as the row crosses the zone, so
   * peak attention is at 0.5, the middle of the crossing, and falls off on BOTH
   * sides. A two-stop ramp would make the row brightest as it left the viewport,
   * which is exactly backwards.
   */
  const scale = useTransform(smooth, [0, 0.5, 1], [SCALE_AWAY, SCALE_FOCUS, SCALE_AWAY])
  const opacity = useTransform(smooth, [0, 0.5, 1], [OPACITY_AWAY, OPACITY_FOCUS, OPACITY_AWAY])

  const MotionTag = Tag === "li" ? m.li : m.div

  return (
    <MotionTag
      ref={ref as never}
      data-fm
      className={className}
      style={{
        scale,
        opacity,
        /* The only continuously-transforming property here, so the only one that
           earns a promoted layer. */
        willChange: "transform, opacity",
      }}
    >
      {children}
    </MotionTag>
  )
}
