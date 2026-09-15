"use client"

import { useEffect, useRef } from "react"
import { useReducedMotion } from "motion/react"
import { useFinePointer } from "./use-media"

/**
 * THE ATMOSPHERE, one light source and one weather clock for the whole document.
 *
 * ── WHY THIS EXISTS AT ALL: 20 EFFECTS, OR ONE MODEL ──────────────────────────
 *
 * The brief asked for a long list of surface effects, a moving sheen here, a
 * shifting edge there, a bloom that follows the cursor on four different kinds of
 * panel. Built the obvious way that is twenty components, each with its own
 * pointer listener, its own rAF and its own idea of where the light is. They then
 * disagree: the card in one band is lit from the left while the panel beside it is
 * lit from the cursor, and the page reads as a collection of tricks.
 *
 * So there is no per-surface light anywhere in this codebase. There is ONE light,
 * published here as custom properties on <html>, and every surface in
 * styles/globals.css reads from it. `.glass-card`, `.lit-surface` and the rest are
 * all downstream of these four numbers. Adding a twenty-first lit surface costs a
 * CSS rule and no JavaScript at all.
 *
 *   --light-x / --light-y   the source, in viewport percentages
 *   --light-warm            0..1, how warm the light currently is (weather)
 *   --light-angle           degrees, the prevailing direction for edge gradients
 *
 * ── ONE LISTENER, AND IT IS PASSIVE AND rAF-THROTTLED ─────────────────────────
 *
 * `pointermove` fires far faster than the display refreshes, and writing a custom
 * property is a style invalidation on the root element, which is the most
 * expensive place on the page to invalidate. So the handler only stores numbers;
 * a single rAF publishes them at most once per frame, and unschedules itself when
 * there is nothing new. An idle page runs no frames.
 *
 * ── THE WEATHER, AND WHY IT IS NOT A LOOP ─────────────────────────────────────
 *
 * A very slow modulation of light warmth and angle, period measured in tens of
 * seconds, so no two minutes on the page look exactly alike. A naive
 * implementation is `setInterval` at 60fps or a permanent rAF, and both are a page
 * that never idles: that is the leak the plan's idle-cost test exists to catch.
 *
 * This ticks on a timer at a deliberately coarse cadence instead. The values move
 * slowly enough that a sub-second update rate would be invisible, so it costs one
 * style write every WEATHER_TICK ms and nothing in between. It is also paused
 * entirely when the tab is hidden, because a background tab modelling the weather
 * is pure battery cost with no observer.
 *
 * ⚠️ REDUCED MOTION TAKES THE LIGHT, NOT THE DARK. A visitor who asked for less
 * motion still gets a lit page, the light simply stops MOVING. The pointer
 * listener is never attached and the weather never ticks, so the declared values
 * in styles/globals.css stand: a centred source, neutral warmth, the default edge
 * angle. Every surface still renders as a surface. That is the same split
 * ./expertise-card.tsx documents, appearance is not motion.
 *
 * ⚠️ AND TOUCH GETS THE SAME. There is no pointer to follow, and a finger arrives
 * already on top of its target. `useFinePointer()` gates the listener exactly as
 * it does in ./expertise-card.tsx.
 */

/** How often the weather is re-published, in ms. Coarse on purpose, see above. */
const WEATHER_TICK = 900

/**
 * The weather periods, in ms. Deliberately COPRIME so the two never re-align into
 * a pattern a reader could learn: warmth peaks on one cycle, angle on another, and
 * the combination does not repeat for an implausibly long time.
 */
const WARM_PERIOD = 41_000
const ANGLE_PERIOD = 67_000

/**
 * The edge-angle swing, in degrees, either side of the declared 145deg.
 *
 * ── SIX DEGREES, AND THE CEILING IS THE DESIGN ────────────────────────────────
 *
 * The same argument ./expertise-card.tsx makes for its 6° tilt and
 * ./mark-rail.tsx for its 1.6° shear. A light that visibly swings is a lighting
 * EFFECT and reads as a screensaver; a light that drifts six degrees over a
 * minute is a room with a window in it. Nobody will ever consciously see this.
 * Raising it is the fastest way to turn the whole atmosphere into a gimmick, and
 * it is the value that would push this into the register data/exclusions.json
 * rules out.
 */
const ANGLE_SWING = 6

/** The warmth swing, 0..1 either side of neutral. Same argument, smaller number. */
const WARM_SWING = 0.5

export function Atmosphere() {
  const reduced = useReducedMotion()
  const fine = useFinePointer()

  /* The pending pointer position, written by the listener and read by the frame.
     A ref rather than state: this must never cause a React render, it publishes
     to CSS, and a re-render per pointermove would be the exact hot-path cost the
     docblock above is avoiding. */
  const pending = useRef<{ x: number; y: number } | null>(null)
  const frame = useRef(0)

  /* ── THE LIGHT FOLLOWS THE POINTER ─────────────────────────────────────────── */
  useEffect(() => {
    if (reduced || !fine) return

    const root = document.documentElement

    const publish = () => {
      frame.current = 0
      const next = pending.current
      if (!next) return
      pending.current = null

      root.style.setProperty("--light-x", `${next.x.toFixed(2)}%`)
      root.style.setProperty("--light-y", `${next.y.toFixed(2)}%`)

      /*
       * ── #6, THE SAME TWO NUMBERS WITHOUT UNITS ────────────────────────────
       *
       * The shadow offset in styles/globals.css has to turn the light's
       * displacement from centre into a PIXEL offset, and `calc()` cannot strip a
       * unit off a percentage, `calc(50% * 0.06px)` is invalid, not merely
       * wrong. So the raw magnitude is published alongside the percentage.
       *
       * Written from the SAME measurement in the same frame, which is the only
       * reason two representations of one value is safe here: they cannot drift,
       * because nothing computes one from the other.
       */
      root.style.setProperty("--light-xn", next.x.toFixed(2))
      root.style.setProperty("--light-yn", next.y.toFixed(2))
    }

    const onMove = (event: PointerEvent) => {
      pending.current = {
        x: (event.clientX / window.innerWidth) * 100,
        y: (event.clientY / window.innerHeight) * 100,
      }
      /* At most one scheduled frame at a time. Without this guard a fast pointer
         queues a callback per event and the throttle does nothing. */
      if (!frame.current) frame.current = requestAnimationFrame(publish)
    }

    window.addEventListener("pointermove", onMove, { passive: true })

    return () => {
      window.removeEventListener("pointermove", onMove)
      if (frame.current) cancelAnimationFrame(frame.current)
      frame.current = 0
      /*
       * `removeProperty`, never a write of the default. Clearing returns the page
       * to the value styles/globals.css declares, which is the same floor used
       * with no JS, on touch and under reduced motion, the discipline every
       * cleanup in ../interactions.ts follows. Writing "50%" here would fork that
       * default into two places that can drift apart.
       */
      root.style.removeProperty("--light-x")
      root.style.removeProperty("--light-y")
      root.style.removeProperty("--light-xn")
      root.style.removeProperty("--light-yn")
    }
  }, [reduced, fine])

  /* ── THE WEATHER ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (reduced) return

    const root = document.documentElement
    let timer = 0

    const tick = () => {
      /*
       * Driven by the WALL CLOCK, not by an accumulating counter. A counter drifts
       * whenever the tab is throttled or paused, so the light would jump on return
       * to a foreground tab. `Date.now()` means the weather is a function of the
       * time of day: it is wherever it should be whenever you look at it, and
       * pausing costs nothing to resume.
       */
      const now = Date.now()
      const warm = Math.sin((now / WARM_PERIOD) * Math.PI * 2)
      const angle = Math.sin((now / ANGLE_PERIOD) * Math.PI * 2)

      root.style.setProperty("--light-warm", (0.5 + warm * WARM_SWING).toFixed(3))
      root.style.setProperty("--light-angle", `${(145 + angle * ANGLE_SWING).toFixed(2)}deg`)
    }

    const start = () => {
      if (timer) return
      tick()
      timer = window.setInterval(tick, WEATHER_TICK)
    }

    const stop = () => {
      if (!timer) return
      window.clearInterval(timer)
      timer = 0
    }

    /* A hidden tab has no observer, so it gets no weather. */
    const onVisibility = () => (document.hidden ? stop() : start())

    if (!document.hidden) start()
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
      root.style.removeProperty("--light-warm")
      root.style.removeProperty("--light-angle")
    }
  }, [reduced])

  /* Publishes to <html> and paints nothing of its own. */
  return null
}
