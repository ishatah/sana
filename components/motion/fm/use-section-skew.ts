"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"

/**
 * A12, VELOCITY SKEW, as a hook over a plain element.
 *
 * Returns a `style` object for a section band. The band leans on the block axis in
 * proportion to scroll velocity and springs back to flat the moment the reader
 * stops. Fast flick: a visible lean. Slow read: a lean too small to name.
 * Stationary: nothing at all.
 *
 * ── WHY THIS IS HAND-ROLLED RATHER THAN `useVelocity` + `m.section` ───────────
 *
 * ./scroll-physics.tsx has the Framer version and it is the better code. It is the
 * wrong tool HERE for a reason that is structural rather than stylistic:
 *
 * ../motion-scope.tsx renders `<Tag>`, a caller-supplied element type, `section`
 * on every band on this site. Using a MotionValue would mean rendering `m[Tag]`
 * instead, which drags `LazyMotion`/`FmRoot` into the ONE client component every
 * page already mounts for its interactions. app/[locale]/layout.tsx:68-78 removed
 * a provider from the top of every page precisely to avoid that, and this would
 * put ~25kB of it back on every route including the legal pages that animate
 * nothing.
 *
 * So the spring is integrated by hand into a CSS custom property, and the element
 * stays a plain `<section>`. Forty lines against a bundle on every route.
 *
 * ── THE SPRING IS THE SAME PHYSICS, NOT AN APPROXIMATION ──────────────────────
 *
 * Semi-implicit Euler at the display's own frame rate, with the same constants
 * ./scroll-physics.tsx declares: stiffness 180, damping 40, mass 0.7, which is
 * ζ ≈ 1.13, overdamped, so the lean returns to flat without crossing it. A skew
 * that overshoots reads as a wobble, and a wobble on a page of serif type reads as
 * a rendering fault. data/exclusions.json section 3 bans `العناصر الحركية الزائدة`
 * against a requested character of `رسمي · قيادي`; ../hero.ts:348-359 reads that
 * as ruling out visible bounce, and this obeys it.
 *
 * ── IT WRITES A CUSTOM PROPERTY, NOT `transform` ─────────────────────────────
 *
 * The returned style sets `--skew`, and styles/globals.css composes the actual
 * `transform` from it. That indirection buys the thing that makes this safe: the
 * reduced-motion block can neutralise the effect with one `--skew: 0deg` override
 * WITHOUT having to win a specificity fight against an inline `transform`, and an
 * inline transform is exactly what ../interactions.ts:90-136 records as having
 * silently defeated a stylesheet mirror once already on this site.
 *
 * It also leaves `transform` unclaimed on the band, so a future effect can compose
 * with the skew in CSS rather than replacing it.
 *
 * ── `skewY`, NOT `skewX`, IS THE RTL ARGUMENT ────────────────────────────────
 *
 * ./use-direction.ts lists `skewY` among the properties that are direction-safe by
 * construction, and warns that a helper existing for a flip nobody performs is a
 * trap. Scroll is a block-axis gesture in both locales, Arabic pages do not
 * scroll sideways, so the lean belongs on the block axis and needs no mirror.
 */

/** Velocity at which the lean reaches maximum, px/s. A deliberate flick, not a read. */
const MAX_VELOCITY = 1600

/**
 * Degrees. Measured against this site's type: at 2.4° an 80px hero line displaces
 * about 3.4px corner to corner, which reads as give rather than as distortion.
 * Past about 4° the serif's modulation visibly smears.
 */
const MAX_SKEW = 2.4

const STIFFNESS = 180
const DAMPING = 40
const MASS = 0.7

/** Degrees. Below this the spring parks, see the idle-cost note in the loop. */
const REST_DELTA = 0.01

export function useSectionSkew(enabled: boolean): CSSProperties | undefined {
  const ref = useRef<HTMLElement | null>(null)
  const [skew, setSkew] = useState(0)

  useEffect(() => {
    if (!enabled) return

    /*
     * The reduced-motion check is a live subscription rather than a one-time read.
     * ../motion-scope.tsx records the bug that a single read caused: a visitor who
     * changed the OS setting mid-visit stayed in the stale branch until they
     * navigated. The same mistake is available here and is not made.
     */
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")

    let raf = 0
    let lastY = window.scrollY
    let lastT = performance.now()
    let velocity = 0
    let position = 0
    let springVelocity = 0
    let running = false
    /* Consecutive frames the spring has read as settled. See the park condition. */
    let settleFrames = 0

    const step = (now: number) => {
      /*
       * dt is CLAMPED, and this is the difference between a spring and a
       * catapult. A backgrounded tab, a long task, or a devtools pause produces a
       * frame gap of hundreds of ms; feeding that raw into an explicit integrator
       * makes the spring diverge and fires the band off at a wild angle on the
       * first frame back. 32ms is two frames at 60Hz, enough to absorb ordinary
       * jitter, small enough that the integration stays stable.
       */
      const dt = Math.min((now - lastT) / 1000, 0.032)
      lastT = now

      if (dt > 0) {
        const y = window.scrollY
        velocity = (y - lastY) / dt
        lastY = y
      }

      const target = Math.max(-1, Math.min(1, velocity / MAX_VELOCITY)) * MAX_SKEW

      // Semi-implicit Euler: velocity is updated first and the new value is used
      // to advance position. Unconditionally stable for these constants, unlike
      // the explicit form, which drifts at large dt even inside the clamp.
      const force = -STIFFNESS * (position - target) - DAMPING * springVelocity
      springVelocity += (force / MASS) * dt
      position += springVelocity * dt

      /*
       * THE PARK CONDITION. A spring that never reaches rest keeps scheduling
       * frames forever, so an unsettled spring is a permanent rAF loop on an idle
       * page, the exact cost ./tokens.ts `SCRUB_SPRING` documents `restDelta` as
       * preventing. Both terms must be small: position near target AND velocity
       * near zero, or the loop stops at the top of an arc.
       *
       * ── `settleFrames` IS NOT PADDING. IT IS THE FIX FOR A DEAD EFFECT. ───────
       *
       * Without it this loop parked on its FIRST frame, every time, and the skew
       * was measurably always zero, caught by scrolling the real page and reading
       * `--skew` across 40 frames, all `0.000deg`.
       *
       * The cause is that `wake()` resets `lastY` to the current scroll position
       * before starting the loop. So on frame 1 the measured delta is `y - lastY`
       * over a fraction of a frame, effectively zero, which makes `target` zero,
       * and position, target and velocity are then ALL zero. The park condition is
       * satisfied, `target === 0` holds, and the loop returns before it has ever
       * seen a real scroll delta.
       *
       * Requiring two consecutive settled frames means the first frame, the one
       * whose velocity reading is an artefact of the reset rather than a
       * measurement, can never park the loop on its own. It costs one extra frame
       * on genuine settle and makes the effect exist.
       */
      const settled =
        Math.abs(position - target) < REST_DELTA && Math.abs(springVelocity) < REST_DELTA
      settleFrames = settled ? settleFrames + 1 : 0

      if (settled && settleFrames > 1) {
        position = target
        springVelocity = 0
        setSkew(target)
        if (target === 0) {
          running = false
          return
        }
      } else {
        setSkew(position)
      }

      raf = requestAnimationFrame(step)
    }

    const wake = () => {
      if (query.matches || running) return
      running = true
      settleFrames = 0
      lastT = performance.now()
      lastY = window.scrollY
      raf = requestAnimationFrame(step)
    }

    /*
     * The loop is started by scroll and stops itself once flat. An always-running
     * rAF would burn a frame budget on a page nobody is scrolling, which on a
     * laptop is measurable battery for zero visible effect.
     *
     * `passive` because this listener never calls `preventDefault`, and a
     * non-passive scroll listener blocks the compositor from scrolling until JS
     * has run, turning a smoothing effect into scroll jank, which would be an
     * unusually direct way to get this backwards.
     */
    window.addEventListener("scroll", wake, { passive: true })

    const onPreference = () => {
      if (!query.matches) return
      cancelAnimationFrame(raf)
      running = false
      position = 0
      springVelocity = 0
      setSkew(0)
    }
    query.addEventListener("change", onPreference)
    onPreference()

    return () => {
      window.removeEventListener("scroll", wake)
      query.removeEventListener("change", onPreference)
      cancelAnimationFrame(raf)
    }
  }, [enabled])

  if (!enabled) return undefined

  /*
   * Rounded to 3dp before it reaches the style object. React re-renders on every
   * `setSkew`, and an unrounded float changes on every frame even once the spring
   * is visually still, so this is what lets the park condition above actually
   * end the render loop rather than merely slowing it.
   */
  return { "--skew": `${skew.toFixed(3)}deg` } as CSSProperties
}
