"use client"

import { useEffect } from "react"

/**
 * PERF TIER, one capability probe for the whole document.
 *
 * ── THE PROBLEM: "BROKEN ON SOME DEVICES" HAD NO DEVICE TEST ──────────────────
 *
 * This site gates motion on TASTE (`prefers-reduced-motion`) and on INPUT
 * (`(pointer: fine)`, ./use-media.ts). It had nothing that asked whether the
 * machine can afford what is being asked of it, so every visitor got the full
 * effect stack: a sprung skew on every band, 3D recession, backdrop-filtered cards
 * that rotate, a full-viewport grain layer and a glowing SVG thread the height of
 * the document. On a current laptop the frame budget absorbs that. On a four-core
 * phone it does not, and effects that miss frames desynchronise from the scroll and
 * read as shaking, which is exactly the reported fault.
 *
 * Reduced motion is NOT the right switch for this. A visitor on a slow phone has
 * not asked for less motion, and someone who asks for less motion is not
 * necessarily on a slow phone. Conflating them would strip the design from people
 * who never asked and leave it in place for people whose devices cannot hold it.
 *
 * ── IT PUBLISHES AN ATTRIBUTE, THE SAME SHAPE AS `--scroll-speed` ─────────────
 *
 * ./page-physics.tsx already establishes the pattern this follows: compute once at
 * the document level, write to <html>, let the stylesheet consume it. No context,
 * no subscribers, no re-renders, and CSS-only consumers become possible, so the
 * whole tier costs a handful of selectors in styles/globals.css rather than a
 * branch inside every animated component.
 *
 *   <html data-perf="lite">
 *
 * Absent means the full tier. That direction matters: the attribute is only ever
 * ADDED, so any failure to probe leaves the site exactly as it was.
 *
 * ── THE SIGNALS, AND WHAT EACH IS ACTUALLY FOR ────────────────────────────────
 *
 *   deviceMemory <= 4        RAM in GiB. The best available proxy for how much
 *                            compositor memory a device can hold, which is what
 *                            decides whether a full-viewport blurred layer is
 *                            affordable.
 *   hardwareConcurrency <= 4 Core count. Style recalculation and layout are
 *                            largely single-threaded, so a low count means a
 *                            smaller per-frame budget.
 *   saveData                 An explicit request to spend less on this page.
 *                            Honouring it for effects, not just bytes, is the
 *                            same courtesy.
 *   (update: slow)           A display that cannot repaint at a normal rate. An
 *                            effect animating faster than the panel refreshes is
 *                            the definition of judder.
 *
 * ⚠️ `deviceMemory` and `saveData` are Chromium-only, and `hardwareConcurrency` is
 * absent on some older Safaris. Nothing here is treated as authoritative: each
 * check is written so that "undefined" fails it, so Safari and Firefox fall
 * through to the full tier. That is the correct failure direction, and it is also
 * why this is a supplement to the real fixes rather than a substitute for them.
 * The per-frame layout and rasterisation work those fixes removed is gone for
 * every browser; this only declines the remaining expensive-but-optional layers on
 * hardware that has told us it is small.
 *
 * ── IT IS READ ONCE, UNLIKE THE MEDIA QUERIES ─────────────────────────────────
 *
 * ../motion-scope.tsx records a real bug caused by sampling `prefers-reduced-motion`
 * once, and every other guard on this site is a live subscription because of it.
 * This one is deliberately different: RAM and core count cannot change during a
 * visit. `(update: slow)` technically can, if a window is dragged to another
 * display, so that one IS subscribed; the rest are read at mount.
 */

/** GiB. At or below this, decline the layers that hold large composited surfaces. */
const MIN_MEMORY = 4

/** Logical cores. At or below this, the per-frame budget is too small for the stack. */
const MIN_CORES = 4

export function PerfTier() {
  useEffect(() => {
    /*
     * Typed locally rather than by widening the global `Navigator`. These are
     * non-standard and Chromium-only, and declaring them globally would let them
     * be read elsewhere in the codebase without this file's caveats attached.
     */
    const nav = navigator as Navigator & {
      deviceMemory?: number
      hardwareConcurrency?: number
      connection?: { saveData?: boolean }
    }

    const slowDisplay =
      typeof matchMedia === "function" ? matchMedia("(update: slow)") : null

    const sync = () => {
      /*
       * Every test is written so a MISSING value is false. `undefined <= 4` is
       * false, and that is the intended reading: an unknown device is a capable
       * one until it says otherwise.
       */
      const lite =
        (typeof nav.deviceMemory === "number" && nav.deviceMemory <= MIN_MEMORY) ||
        (typeof nav.hardwareConcurrency === "number" &&
          nav.hardwareConcurrency <= MIN_CORES) ||
        nav.connection?.saveData === true ||
        slowDisplay?.matches === true

      const root = document.documentElement
      if (lite) root.dataset.perf = "lite"
      else delete root.dataset.perf
    }

    sync()
    slowDisplay?.addEventListener("change", sync)

    return () => {
      slowDisplay?.removeEventListener("change", sync)
      /* Same cleanup discipline as ./page-physics.tsx: clear what this wrote and
         never write a default, so the stylesheet stays the single source of the
         full-tier behaviour. */
      delete document.documentElement.dataset.perf
    }
  }, [])

  return null
}
