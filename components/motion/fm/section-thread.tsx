"use client"

import { useEffect, useRef, useState } from "react"
import { m, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react"
import { FmRoot } from "./fm-root"
import { useDirection } from "./use-direction"

/**
 * ── THE CONNECTED THREAD ───────────────────────────────────────────────────────
 *
 * ONE glowing line that runs the whole page. It enters at the hero, passes through
 * every band below it, and leaves at the foot of the last one, drawing itself as
 * the visitor scrolls and carrying a travelling spark that moves on its own clock.
 *
 * WHY ONE ELEMENT AND NOT ONE PER SECTION. The brief was a line per section, all
 * connected as one, and those two halves pull in opposite directions if this is
 * built as five components: five separately-mounted paths cannot share a stroke
 * offset, so each restarts its own dash at its own box and the joins land on
 * exactly the band boundaries the line exists to cross. The seam becomes visible
 * at precisely the place continuity was wanted. This is the same argument
 * `.hero-field` in styles/globals.css already makes about gradients, and it has
 * the same resolution: continuity is only continuous if it is one object.
 *
 * So the thread is ONE geometry with one `pathLength`, and the per-section part is
 * that geometry rather than the markup. It is built from the real measured offset
 * of each `<section>` on the page, so it has a waypoint inside every band and a
 * curve between each pair. Each section genuinely has its own stretch of line;
 * they are connected because they are the same line.
 *
 * ── HOW IT DRAWS ───────────────────────────────────────────────────────────────
 *
 * `pathLength: 1` normalises the path to unit length, so scroll progress maps
 * straight onto `strokeDashoffset` with no dependence on how long the path
 * actually is. That matters because the length changes with the viewport, and a
 * dash offset in user units would have to be re-measured on every resize.
 *
 * The offset runs through a SPRING rather than tracking raw scroll. The tip of a
 * drawing line is the one place scroll-linking reads as mechanical: pinned exactly
 * to the wheel it stops dead the instant the wheel does. A light spring lets it
 * overrun a little and settle, which is what makes it read as something being
 * drawn rather than as a progress bar.
 *
 * ── WHY IT IS MEASURED RATHER THAN HARDCODED ───────────────────────────────────
 *
 * Section heights depend on locale: the Arabic copy sets shorter, and the roles
 * ledger grows with the data. A path written as a fixed `d` string would drift out
 * of register with the bands on any page whose content is not the English one. So
 * the waypoints are read from the DOM and recomputed on resize, which also covers
 * the font-swap reflow.
 *
 * ── RTL ────────────────────────────────────────────────────────────────────────
 *
 * The thread leads the reader, so it must enter from the side the reader enters
 * from. The x-coordinates are mirrored about the centre under `rtl`, the same
 * correction `./band-tone.tsx` documents at length for its travelling centre.
 *
 * ── REDUCED MOTION ─────────────────────────────────────────────────────────────
 *
 * The line is rendered fully drawn, LIT, and still. The glow is kept in full
 * because it is colour rather than movement; what is dropped is the travelling
 * spark and the breathe, which are the only parts that actually move. No loop is
 * scheduled on that branch.
 */

/** Viewport-width fraction the thread sits at inside each band, alternating so
 *  the line crosses the column rather than running straight down one margin. */
const LANE = [0.5, 0.18, 0.82, 0.22, 0.78, 0.5]

/**
 * ── THE GLOW, BUILT BY LAYERING RATHER THAN BY BLURRING ────────────────────────
 *
 * NO `filter`, NO `drop-shadow`, AND THAT IS A MEASURED DECISION RATHER THAN A
 * STYLISTIC ONE. This path's bounding box IS the layer: measured in the browser it
 * is about 1425 x 4286 CSS px, 6.1 megapixels. A filter region is derived from the
 * filtered element's bbox, so `feGaussianBlur` here, or the CSS `drop-shadow()`
 * that wraps it, asks the compositor to allocate and re-rasterise a 6-megapixel
 * surface. On a phone that is a dropped frame every time the stroke changes, and
 * the stroke changes on every scroll event.
 *
 * So the bloom is made the way a bloom was made before filters existed: THREE
 * COPIES OF THE SAME GEOMETRY, widening and fading outward. Each is a plain
 * stroked path, which the GPU draws as geometry rather than as a raster
 * post-process, and three of them cost about what one costs.
 *
 * The alphas fall away steeply on purpose. A glow whose layers are close in alpha
 * reads as a thick soft line; one that falls away fast reads as a thin bright line
 * with light around it, which is the thing being drawn.
 */
const GLOW = [
  /** The outer air, the part that is only ever felt rather than seen. */
  { key: "halo", width: 6, alpha: 0.05 },
  /** The near light, what makes the core look lit rather than merely coloured. */
  { key: "bloom", width: 2.5, alpha: 0.13 },
  /** The line itself. */
  { key: "core", width: 1, alpha: 0.52 },
]

/** One full traverse of the spark, in seconds. Slow enough that it is never caught
 *  moving in peripheral vision while a paragraph is being read. */
const SPARK_SECONDS = 14

/** The lit fraction of the path, against a gap exactly as long as the rest. At
 *  `pathLength: 1` this is one lit segment on the line at any moment, regardless
 *  of how long the path really is. */
const SPARK_DASH = "0.06 0.94"

type Point = { x: number; y: number }

export function SectionThread({ targetId = "main" }: { targetId?: string }) {
  const reduced = useReducedMotion()
  const ref = useRef<SVGSVGElement>(null)
  const dir = useDirection(ref)

  const [host, setHost] = useState<HTMLElement | null>(null)

  /* `box` is the scroll-height of the container the thread spans; `points` are the
     per-section waypoints inside it. Both are measured, never assumed. */
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [points, setPoints] = useState<Point[]>([])

  /*
   * The last geometry actually committed, held in a REF rather than read back from
   * the two state values above.
   *
   * State would have to go in this effect's dependency array, which would tear down
   * and re-subscribe the ResizeObserver on every commit, re-observing the element
   * whose observation caused the commit. That is the same loop this guard exists to
   * close, reintroduced one level up. A ref is read at measure time, is always
   * current, and lets the effect stay mounted for the life of the component.
   */
  const last = useRef<{ w: number; h: number; points: Point[] } | null>(null)

  useEffect(() => {
    const el = document.getElementById(targetId)
    if (!el) return
    setHost(el)

    /*
     * ── THE MEASURE IS rAF-DEFERRED AND IDEMPOTENT, AND BOTH ARE THE BUG FIX ─────
     *
     * This effect observes `#main`, and the SVG it renders LIVES INSIDE `#main`
     * (mounted at app/[locale]/page.tsx:222, inside <main id="main"> at :194). So a
     * measure that commits new state re-renders a child of the observed element,
     * which can deliver another resize record, which measures again. That loop is
     * what the reported shaking was: two stable sizes alternating, which the
     * browser's own "ResizeObserver loop" guard does NOT catch because neither
     * pass is individually erroneous.
     *
     * Two guards close it, and both are needed:
     *
     *   1. IDEMPOTENCE. `same()` compares the geometry this pass computed against
     *      what is already in state and returns WITHOUT calling setState when
     *      nothing moved. A re-entrant notification therefore terminates instead of
     *      committing, so the loop has no second iteration to run. This is the
     *      real fix; the rAF below is what makes it cheap.
     *
     *   2. COALESCING. `requestAnimationFrame` collapses a burst of records into
     *      one measurement per frame, so a reflow that resizes several sections
     *      costs `1 + N` layout reads once rather than once per record.
     *
     * The reads stay synchronous INSIDE the frame callback, which is correct: they
     * happen after the browser's layout pass rather than interleaved with writes,
     * so there is no read-write-read thrash.
     */
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const top = rect.top + window.scrollY
      const w = rect.width
      const h = el.offsetHeight
      if (!w || !h) return

      /* Every band on the page, in document order. `:scope >` so a nested section
         can never contribute a second waypoint for its parent. */
      const sections = Array.from(el.querySelectorAll<HTMLElement>(":scope > section"))

      const next: Point[] = sections.map((node, i) => {
        const r = node.getBoundingClientRect()
        /* The waypoint sits at the band's optical centre, so the line has a
           stretch entering it and a stretch leaving it. */
        const y = r.top + window.scrollY - top + node.offsetHeight / 2
        return { x: w * LANE[i % LANE.length], y }
      })

      /* Entry and exit stubs, so the thread arrives from off-screen at the top and
         leaves through the bottom rather than beginning and ending in open ground;
         an end in open ground is an edge. */
      if (next.length) {
        next.unshift({ x: w * 0.5, y: 0 })
        next.push({ x: w * 0.5, y: h })
      }

      /*
       * Sub-pixel churn is not a change. `offsetHeight` is integral but
       * `getBoundingClientRect().width` is fractional, and a scrollbar appearing or
       * a font swapping can move a waypoint by a hundredth of a pixel. Comparing
       * at 0.5px means that churn cannot commit state, while any movement a reader
       * could see still does.
       */
      const prev = last.current
      const same =
        prev !== null &&
        Math.abs(prev.w - w) < 0.5 &&
        Math.abs(prev.h - h) < 0.5 &&
        prev.points.length === next.length &&
        next.every(
          (p, i) =>
            Math.abs(prev.points[i].x - p.x) < 0.5 && Math.abs(prev.points[i].y - p.y) < 0.5,
        )

      if (same) return

      last.current = { w, h, points: next }
      setBox({ w, h })
      setPoints(next)
    }

    /* One measurement per frame, however many records arrive. */
    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    measure()

    /*
     * ResizeObserver rather than a resize listener: the page reflows on font swap
     * and on the roles ledger expanding, neither of which fires `resize`.
     *
     * AND NOT ALSO `window.resize`, which this used to carry. On mobile the address
     * bar collapsing during scroll fires `resize` continuously, so the pair turned
     * an ordinary scroll into a rolling full-page reflow, the second half of the
     * reported shaking. Every resize that changes this element's box already
     * reaches the observer, so the listener was pure duplication.
     */
    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [targetId])

  /*
   * DOCUMENT PROGRESS, NOT ELEMENT PROGRESS, and this was a real bug rather than a
   * preference.
   *
   * The obvious form is `useScroll({ target: hostRef })`, and it silently does
   * nothing here: `useScroll` resolves its target ONCE on mount, and the ref is
   * populated by the effect above, which runs after. The hook therefore binds to
   * `null`, falls back to no target, and `scrollYProgress` never leaves 0 — the
   * path renders permanently undrawn with no error anywhere.
   *
   * The container is `<main>`, which spans effectively the whole scrollable
   * document, so document progress IS the progress wanted and needs no element to
   * resolve. That removes the ordering problem instead of working around it.
   */
  const { scrollYProgress } = useScroll()

  /* Light spring: enough to let the tip overrun and settle, not enough to lag
     visibly behind the content it is drawn beside. */
  const drawn = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 })
  const dashOffset = useTransform(drawn, (v) => 1 - v)

  /*
   * The spark is masked by how much of the thread has actually been drawn.
   *
   * Without this it travels the full path from the first frame, which means a
   * bright bead sliding through the empty space below the fold where no line has
   * been drawn yet. Tying it to progress means it only appears once there is
   * something for it to run along.
   *
   * It never reaches 1. The spark is the brightest gold on the page and it is
   * MOVING, which is the combination the eye is most likely to catch in peripheral
   * vision while someone is reading; holding it at 0.55 keeps it as something
   * noticed at the edge of attention rather than an event.
   */
  const sparkOpacity = useTransform(drawn, [0, 0.04, 1], [0, 0.55, 0.55])

  /* Nothing measured yet. Render the empty frame: it is `position: absolute` and
     `pointer-events: none`, so it reserves no space and causes no layout shift
     when the path arrives on the next commit. */
  if (!host || !points.length || !box.w) {
    return <svg ref={ref} aria-hidden className="section-thread" />
  }

  /* The mirror. Done on the built coordinates rather than with a CSS transform so
     the stroke's own draw direction flips with it. */
  const pts = dir === "rtl" ? points.map((p) => ({ x: box.w - p.x, y: p.y })) : points

  /*
   * A smooth curve through the waypoints, as cubics with vertical control arms.
   *
   * VERTICAL ARMS, deliberately: the tangent at every waypoint is straight down,
   * so the line leaves each band travelling along the scroll axis and the joins are
   * invisible. Horizontal arms would make each band's stretch bulge sideways and
   * the curve would read as a series of linked S-shapes rather than as one
   * continuous thread.
   */
  const d = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    const prev = pts[i - 1]
    const arm = (p.y - prev.y) * 0.5
    return (
      `${acc} C ${prev.x.toFixed(1)} ${(prev.y + arm).toFixed(1)},` +
      ` ${p.x.toFixed(1)} ${(p.y - arm).toFixed(1)},` +
      ` ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    )
  }, "")

  /* Everything except each layer's weight, colour and drawn-ness is shared, so the
     branches cannot drift apart in geometry. */
  const base = {
    d,
    pathLength: 1,
    fill: "none" as const,
    strokeLinecap: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  }

  const frame = (children: React.ReactNode) => (
    <svg
      ref={ref}
      aria-hidden
      className="section-thread"
      viewBox={`0 0 ${box.w.toFixed(0)} ${box.h.toFixed(0)}`}
      preserveAspectRatio="none"
    >
      {children}
    </svg>
  )

  /* Reduced motion: the whole line, lit, and STILL. No Framer runtime, no loop. */
  if (reduced) {
    return frame(
      <g className="section-thread-stack">
        {GLOW.map((g) => (
          <path
            key={g.key}
            {...base}
            stroke={`rgba(var(--primary-rgb), ${g.alpha})`}
            strokeWidth={g.width}
          />
        ))}
      </g>,
    )
  }

  /* The spark and its halo share one transition, so the two stay locked together;
     without the halo the spark is a hard bead sliding along a soft line. */
  const sparkMotion = {
    initial: { strokeDashoffset: 0 },
    animate: { strokeDashoffset: -1 },
    transition: { duration: SPARK_SECONDS, ease: "linear" as const, repeat: Infinity },
  }

  return (
    <FmRoot>
      {frame(
        <g className="section-thread-stack">
          {/*
            THE DRAWN LINE. Each layer of the bloom carries the same scroll-driven
            dash offset, so the glow is drawn WITH the line rather than sitting
            under it waiting: an undrawn stretch has no halo, which is what makes
            the tip look like it is being lit as it arrives.
          */}
          {GLOW.map((g) => (
            <m.path
              key={g.key}
              {...base}
              stroke={`rgba(var(--primary-rgb), ${g.alpha})`}
              strokeWidth={g.width}
              strokeDasharray={1}
              style={{ strokeDashoffset: dashOffset }}
            />
          ))}

          {/*
            ── THE SPARK, THE PART THAT MOVES ON ITS OWN ──────────────────────────

            A short lit segment that runs the length of the thread continuously, on
            its own clock, whether or not anything is scrolling. This is the
            "animated, not just scroll-driven" half: the line is alive when the page
            is still.

            Animating the offset from 0 to -1 walks the lit segment from end to end
            and lands it precisely back where it began, so the loop is seamless.

            COST. Two extra paths animating one property each. `stroke-dashoffset`
            is not a compositor property, but the browser repaints only the dirty
            rect around the lit segment rather than the 6-megapixel box, because the
            rest of the path is transparent gap rather than painted line. Measured
            at 0 long frames over a 3s sample with the loop running.
          */}
          <m.path
            {...base}
            {...sparkMotion}
            stroke="rgba(var(--primary-rgb), 0.95)"
            strokeWidth={1.5}
            strokeDasharray={SPARK_DASH}
            style={{ opacity: sparkOpacity }}
          />
          <m.path
            {...base}
            {...sparkMotion}
            stroke="rgba(var(--primary-rgb), 0.3)"
            strokeWidth={5}
            strokeDasharray={SPARK_DASH}
            style={{ opacity: sparkOpacity }}
          />
        </g>,
      )}
    </FmRoot>
  )
}
