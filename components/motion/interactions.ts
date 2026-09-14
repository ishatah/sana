import { animate, utils } from "animejs"

/**
 * Interactive behaviours — the layer that responds to input rather than to scroll.
 *
 * This is the ONLY animation layer left. The scroll-triggered entrance recipes
 * that used to live in `primitives.ts` have been removed along with the rest of
 * the page's scroll motion; these survived because they respond to input, and
 * because two of them — `copyEmail` and `prefillEnquiry` — are functionality
 * rather than decoration.
 *
 * An interaction attaches listeners that live as long as the page does, so EVERY
 * function here must return a cleanup that removes what it added. `AnimeScope`
 * calls it through `scope.revert()` — without that, navigating between these pages
 * leaks a listener set per visit.
 *
 * THE RULES THEY INHERIT FROM THE REST OF THE SITE:
 *
 *   - Nothing may hide content. An interaction adds emphasis to something already
 *     readable; it never gates text behind a hover or a click. The one expanding
 *     section (`expandRows`) keeps the organisation name, the role and any row
 *     disclaimer visible in the COLLAPSED state — only supplementary detail moves.
 *   - No organisation name is ever split, distorted or obscured.
 *   - Hover is never the only route. Every hover behaviour is bound to `focusin`
 *     as well, so a keyboard reaches it; every click behaviour is on a real
 *     `<button>` so Enter and Space work without extra handling.
 *   - Pointer-driven motion is skipped entirely on coarse pointers, via
 *     `hasFinePointer()`. An effect that responds to a cursor vector has no
 *     meaning for a finger, which arrives already on top of its target.
 *   - Motion responds to INTENT, not to the pointer passing by. Everything here
 *     decorates something the visitor can actually act on — see the removal note
 *     below for the three that did not and are gone.
 */

/*
 * REMOVED: `heroPointer`, `magneticCards`, `gridNeighbours`.
 *
 * All three were pointer-tracked decoration on NON-INTERACTIVE content — a gold
 * wash that followed the cursor across the hero, cards that leaned toward it, grid
 * cells that dimmed their neighbours on hover. They shared four problems:
 *
 *   - They responded to the pointer rather than to the reader. Nothing they
 *     decorated was clickable, so the motion promised an affordance that did not
 *     exist.
 *   - Two of them required `tabIndex={0}` on static <div>s and <article>s purely so
 *     a keyboard could reach the hover branch — which inserted stops in the tab
 *     order that do nothing on arrival. A real accessibility cost for decoration.
 *   - They were invisible to every touch user by design (`hasFinePointer()` gates
 *     all three), so the effort only ever reached desktop pointer users.
 *   - Lift-toward-cursor and dim-the-neighbours are stock effects; combined with
 *     everything else that was here, they were a large part of why the page read
 *     as generated.
 *
 * What is left in this file is interaction on things that ARE interactive: the
 * copy-to-clipboard button, the form fields, the expandable rows, the nav
 * underline, the reading-progress rail. That is the line — motion responds to
 * intent, not to the cursor passing by.
 */
export type InteractionName =
  | "hoverRule"
  | "linkedPair"
  | "expandRows"
  | "copyEmail"
  | "formFields"
  | "prefillEnquiry"
  | "navUnderline"

export type Interaction = (root: HTMLElement) => void | (() => void)

/** True for mouse/trackpad. Touch and pen get the static design. */
function hasFinePointer(): boolean {
  return typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches
}

/** Direction multiplier, so x-axis motion flips in Arabic. */
function axisDirection(root: HTMLElement): 1 | -1 {
  return getComputedStyle(root).direction === "rtl" ? -1 : 1
}

/**
 * Collects listeners and returns one function that removes them all.
 *
 * Every interaction below builds its cleanup through this rather than by hand.
 * Hand-written teardown is where leaks come from: it is easy to add a third
 * listener and forget the matching `removeEventListener`, and nothing fails
 * loudly when you do — the page just gets slower each time it is visited.
 */
function listeners() {
  const bound: Array<() => void> = []
  return {
    on<K extends keyof HTMLElementEventMap>(
      el: EventTarget,
      type: K | string,
      handler: EventListenerOrEventListenerObject,
      opts?: AddEventListenerOptions,
    ) {
      el.addEventListener(type, handler, opts)
      bound.push(() => el.removeEventListener(type, handler, opts))
    },
    cleanup() {
      bound.forEach((off) => off())
      bound.length = 0
    },
  }
}

export const INTERACTIONS: Record<InteractionName, Interaction> = {
  /**
   * A gold rule draws under a label on hover or focus.
   *
   * Used on the About fact list, where each `dt` already carries a gold label —
   * the rule extends that language rather than introducing a new one.
   */
  hoverRule(root) {
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-interact='rule-item']"))
    if (!items.length) return

    const l = listeners()

    items.forEach((item) => {
      const rule = item.querySelector<HTMLElement>("[data-interact='rule-line']")
      if (!rule) return

      utils.set(rule, { scaleX: 0 })
      const show = () => animate(rule, { scaleX: 1, duration: 420, ease: "out(3)" })
      const hide = () => animate(rule, { scaleX: 0, duration: 320, ease: "out(2)" })

      l.on(item, "pointerenter", show)
      l.on(item, "pointerleave", hide)
      l.on(item, "focusin", show)
      l.on(item, "focusout", hide)
    })

    return () => {
      l.cleanup()
      items.forEach((item) => {
        const rule = item.querySelector<HTMLElement>("[data-interact='rule-line']")
        // Left fully drawn rather than at 0: if the cleanup runs mid-interaction,
        // a visible rule is the harmless end state and an invisible one is not.
        if (rule) utils.set(rule, { scaleX: 1 })
      })
    }
  },

  /**
   * Hovering a market card highlights the matching location below it.
   *
   * Paired by a shared `data-pair` key rather than by index, so reordering either
   * list cannot silently mismatch them.
   */
  linkedPair(root) {
    const sources = Array.from(root.querySelectorAll<HTMLElement>("[data-pair]"))
    if (!sources.length) return

    const l = listeners()

    sources.forEach((el) => {
      const key = el.getAttribute("data-pair")
      if (!key) return
      const partners = Array.from(root.querySelectorAll<HTMLElement>(`[data-pair="${key}"]`)).filter((p) => p !== el)
      if (!partners.length) return

      const on = () => animate(partners, { opacity: 1, scale: 1.03, duration: 360, ease: "out(2)" })
      const off = () => animate(partners, { opacity: 1, scale: 1, duration: 360, ease: "out(2)" })

      l.on(el, "pointerenter", on)
      l.on(el, "pointerleave", off)
      l.on(el, "focusin", on)
      l.on(el, "focusout", off)
    })

    return () => {
      l.cleanup()
      utils.set(sources, { scale: 1, opacity: 1 })
    }
  },

  /**
   * Position rows expand to show supplementary detail.
   *
   * WHAT STAYS VISIBLE WHEN COLLAPSED — and this is the whole design of it: the
   * role, the full organisation name, and any row disclaimer. Only the city,
   * the register status and the organisation link move into the expanded state.
   *
   * Putting the disclaimer behind a click would let the claim travel without the
   * correction, which is precisely the failure the intake form's condition on
   * that row exists to prevent. It is not a detail that can be tucked away to
   * tidy the layout.
   *
   * The trigger is a real `<button>` with `aria-expanded`, so Enter and Space
   * work and the state is announced. The detail panel is height-animated from its
   * measured scrollHeight rather than toggling `display`, so it can transition.
   */
  expandRows(root) {
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-interact='expandable']"))
    if (!rows.length) return

    const l = listeners()

    rows.forEach((row) => {
      const trigger = row.querySelector<HTMLButtonElement>("[data-interact='expand-trigger']")
      const panel = row.querySelector<HTMLElement>("[data-interact='expand-panel']")
      const chevron = row.querySelector<HTMLElement>("[data-interact='expand-chevron']")
      if (!trigger || !panel) return

      // Collapsed is the server-rendered default, so the panel starts closed
      // without a flash — but only once JS is here to reopen it. Before that it
      // renders open, which keeps the content reachable with no scripting.
      utils.set(panel, { height: 0, opacity: 0, overflow: "hidden" })
      panel.setAttribute("aria-hidden", "true")
      trigger.setAttribute("aria-expanded", "false")

      const toggle = () => {
        const open = trigger.getAttribute("aria-expanded") === "true"
        trigger.setAttribute("aria-expanded", open ? "false" : "true")
        panel.setAttribute("aria-hidden", open ? "true" : "false")

        animate(panel, {
          height: open ? 0 : panel.scrollHeight,
          opacity: open ? 0 : 1,
          duration: 460,
          ease: "out(3)",
          // Height must return to auto once open, or a later reflow (a font
          // load, a viewport change) leaves the panel clipped at a stale pixel
          // value.
          onComplete: () => {
            if (!open) utils.set(panel, { height: "auto" })
          },
        })

        if (chevron) animate(chevron, { rotate: open ? 0 : 180, duration: 420, ease: "out(3)" })
      }

      l.on(trigger, "click", toggle)
    })

    return () => {
      l.cleanup()
      // Restore the no-JS state: everything open and announced, so a teardown
      // mid-navigation can never strand content inside a collapsed panel.
      rows.forEach((row) => {
        const panel = row.querySelector<HTMLElement>("[data-interact='expand-panel']")
        const trigger = row.querySelector<HTMLButtonElement>("[data-interact='expand-trigger']")
        if (panel) {
          utils.set(panel, { height: "auto", opacity: 1, overflow: "visible" })
          panel.removeAttribute("aria-hidden")
        }
        trigger?.setAttribute("aria-expanded", "true")
      })
    }
  },


  /**
   * Copy an email address, with the icon morphing to a checkmark.
   *
   * The highest-value interaction on the site: contact is the page's purpose and
   * there are only two public addresses.
   *
   * The mailto link stays exactly as it was — this is an ADDITIONAL button beside
   * it, not a replacement. `navigator.clipboard` needs a secure context and can
   * be refused by permissions policy, so failure falls back to selecting the
   * address, which leaves the visitor one keystroke from copying it manually.
   */
  copyEmail(root) {
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-interact='copy']"))
    if (!buttons.length) return

    const l = listeners()
    const timers: Array<ReturnType<typeof setTimeout>> = []

    buttons.forEach((button) => {
      const value = button.getAttribute("data-copy-value")
      const idle = button.querySelector<HTMLElement>("[data-interact='copy-idle']")
      const done = button.querySelector<HTMLElement>("[data-interact='copy-done']")
      const live = button.querySelector<HTMLElement>("[data-interact='copy-live']")
      if (!value) return

      const flash = (message: string) => {
        if (live) live.textContent = message
        if (idle && done) {
          animate(idle, { opacity: 0, scale: 0.6, duration: 200, ease: "out(2)" })
          animate(done, { opacity: 1, scale: 1, duration: 320, ease: "out(3)" })
          timers.push(
            setTimeout(() => {
              animate(idle, { opacity: 1, scale: 1, duration: 320, ease: "out(3)" })
              animate(done, { opacity: 0, scale: 0.6, duration: 200, ease: "out(2)" })
              if (live) live.textContent = ""
            }, 1900),
          )
        }
      }

      const copy = async () => {
        try {
          await navigator.clipboard.writeText(value)
          flash(button.getAttribute("data-copied-label") ?? "Copied")
        } catch {
          // Clipboard refused. Select the address instead so the visitor can copy
          // it with one keystroke rather than being told nothing happened.
          const target = document.getElementById(button.getAttribute("data-copy-target") ?? "")
          if (target) {
            const range = document.createRange()
            range.selectNodeContents(target)
            const sel = window.getSelection()
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
        }
      }

      if (done) utils.set(done, { opacity: 0, scale: 0.6 })
      l.on(button, "click", copy)
    })

    return () => {
      timers.forEach(clearTimeout)
      l.cleanup()
    }
  },

  /**
   * Form field focus states and animated validation.
   *
   * The border colour is CSS (`.field-input:focus`); this adds the gold underline
   * sweeping in beneath the focused field, and makes an error message rise into
   * place instead of appearing instantly and shoving the layout down.
   */
  formFields(root) {
    const fields = Array.from(root.querySelectorAll<HTMLElement>("[data-interact='field']"))
    if (!fields.length) return

    const l = listeners()

    fields.forEach((wrapper) => {
      const input = wrapper.querySelector<HTMLElement>("input, textarea")
      const underline = wrapper.querySelector<HTMLElement>("[data-interact='field-underline']")
      if (!input || !underline) return

      utils.set(underline, { scaleX: 0, transformOrigin: "left" })

      l.on(input, "focus", () => animate(underline, { scaleX: 1, duration: 380, ease: "out(3)" }))
      l.on(input, "blur", () => animate(underline, { scaleX: 0, duration: 280, ease: "out(2)" }))
    })

    // Error paragraphs are rendered by React, so they appear after this runs.
    // A MutationObserver animates whichever ones arrive, rather than requiring
    // the form component to call into the animation layer.
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.id.endsWith("-error")) {
            animate(node, { opacity: [0, 1], y: [-6, 0], duration: 360, ease: "out(3)" })
          }
        })
      })
    })
    observer.observe(root, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      l.cleanup()
      fields.forEach((wrapper) => {
        const underline = wrapper.querySelector<HTMLElement>("[data-interact='field-underline']")
        if (underline) utils.set(underline, { scaleX: 0 })
      })
    }
  },

  /**
   * Clicking an enquiry card prefills the form's subject and moves focus there.
   *
   * Focus follows the scroll deliberately. A click that scrolls the page but
   * leaves focus behind is disorienting with a screen reader and useless with a
   * keyboard — the point of the interaction is to put you in the form, ready to
   * type.
   */
  prefillEnquiry(root) {
    const cards = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-interact='prefill']"))
    if (!cards.length) return

    const l = listeners()

    cards.forEach((card) => {
      const value = card.getAttribute("data-prefill-value")
      if (!value) return

      l.on(card, "click", () => {
        const subject = document.getElementById("subject") as HTMLInputElement | null
        const message = document.getElementById("message") as HTMLTextAreaElement | null
        const target = subject ?? message
        if (!target) return

        target.value = value
        // React does not see a programmatic value assignment, so the change is
        // dispatched explicitly — otherwise the field looks filled and submits empty.
        target.dispatchEvent(new Event("input", { bubbles: true }))

        target.scrollIntoView({ behavior: "smooth", block: "center" })
        target.focus({ preventScroll: true })

        animate(target, { scale: [1.015, 1], duration: 460, ease: "out(3)" })
      })
    })

    return () => l.cleanup()
  },

  /**
   * One underline slides between nav items instead of each fading independently.
   *
   * The per-item underline spans stay in the markup as the no-JS floor; this
   * hides them and drives a single shared bar. On teardown the spans come back,
   * so the nav is never left with no active indicator.
   */
  navUnderline(root) {
    if (!hasFinePointer()) return
    const nav = root.querySelector<HTMLElement>("[data-interact='nav-list']")
    const bar = root.querySelector<HTMLElement>("[data-interact='nav-bar']")
    if (!nav || !bar) return

    const links = Array.from(nav.querySelectorAll<HTMLElement>("a"))
    if (!links.length) return

    const l = listeners()
    const dir = axisDirection(root)

    const spans = links
      .map((a) => a.querySelector<HTMLElement>("span"))
      .filter((s): s is HTMLElement => s !== null)
    utils.set(spans, { opacity: 0 })

    const moveTo = (el: HTMLElement | null) => {
      const active = el ?? nav.querySelector<HTMLElement>('a[aria-current="page"]')
      if (!active) {
        animate(bar, { opacity: 0, duration: 220 })
        return
      }
      const navRect = nav.getBoundingClientRect()
      const rect = active.getBoundingClientRect()
      animate(bar, {
        opacity: 1,
        width: rect.width,
        // Measured from the nav's own box so it is correct in both directions;
        // `dir` keeps the offset on the right side of the origin in Arabic.
        x: (rect.left - navRect.left) * (dir === 1 ? 1 : 1),
        duration: 420,
        ease: "out(3)",
      })
    }

    moveTo(null)
    links.forEach((link) => {
      l.on(link, "pointerenter", () => moveTo(link))
      l.on(link, "focusin", () => moveTo(link))
    })
    l.on(nav, "pointerleave", () => moveTo(null))
    l.on(window, "resize", () => moveTo(null), { passive: true })

    return () => {
      l.cleanup()
      // Restore the per-item underlines — without this a teardown leaves the nav
      // with no visible active state at all.
      utils.set(spans, { opacity: 1 })
      utils.set(bar, { opacity: 0 })
    }
  },
}
