import { animate, inView } from "motion"
import { DUR, EASE, easeOut } from "./tokens"
import { setStyles, clearStyles, type Handle } from "./dom"

/**
 * Interactive behaviours, the layer that responds to input rather than to scroll.
 *
 * This is the ONLY animation layer left. The scroll-triggered entrance recipes
 * that used to live in `primitives.ts` have been removed along with the rest of
 * the page's scroll motion; these survived because they respond to input, and
 * because two of them, `copyEmail` and `prefillEnquiry`, are functionality
 * rather than decoration.
 *
 * An interaction attaches listeners that live as long as the page does, so EVERY
 * function here must return a cleanup that removes what it added. `MotionScope`
 * calls it on unmount, without that, navigating between these pages leaks a
 * listener set per visit.
 *
 * ── THE ENGINE IS MOTION, AND TWO THINGS ABOUT IT MATTER HERE ──────────────────
 *
 * 1. DURATIONS ARE IN SECONDS. `DUR.d3` already returns seconds (see tokens.ts);
 *    no call site should ever write a raw millisecond number into `duration`.
 * 2. ANIMATIONS MUST BE STOPPED, NOT JUST UNBOUND. The anime.js `scope.revert()`
 *    reverted every animation created inside it. Motion has no equivalent, so
 *    every interaction that can leave an animation in flight tracks its handles
 *    and calls `.stop()` in its cleanup, otherwise a running animation keeps
 *    writing to an element after the component that owns it has gone.
 *
 * THE RULES THEY INHERIT FROM THE REST OF THE SITE:
 *
 *   - Nothing may hide content. An interaction adds emphasis to something already
 *     readable; it never gates text behind a hover or a click. The one expanding
 *     section (`expandRows`) keeps the organisation name, the role and any row
 *     disclaimer visible in the COLLAPSED state, only supplementary detail moves.
 *   - No organisation name is ever split, distorted or obscured.
 *   - Hover is never the only route. Every hover behaviour is bound to `focusin`
 *     as well, so a keyboard reaches it; every click behaviour is on a real
 *     `<button>` so Enter and Space work without extra handling.
 *   - Pointer-driven motion is skipped entirely on coarse pointers, via
 *     `hasFinePointer()`. An effect that responds to a cursor vector has no
 *     meaning for a finger, which arrives already on top of its target.
 *   - Motion responds to INTENT, not to the pointer passing by. Everything here
 *     decorates something the visitor can actually act on, see the removal note
 *     below for the three that did not and are gone.
 */

/*
 * REMOVED: `heroPointer`, `gridNeighbours`.
 *
 * ⚠️ `magneticCards` WAS REMOVED HERE TOO AND HAS SINCE RETURNED, in a different
 * layer and a different form: components/motion/fm/expertise-card.tsx tilts the
 * expertise cards toward the pointer. The client asked for it back after being
 * shown this note and the `promotional-tone` entry in data/exclusions.json that
 * backs it. Three of the four objections below are answered there rather than
 * dismissed, the cards never become focusable, touch drives nothing at all, and
 * the gesture is a rotation in place rather than the lift-toward-cursor called
 * out below. The affordance objection stands and is named as the residual.
 *
 * The rest of this note still governs. It is the reason nothing NEW in this file
 * tracks the pointer, and the reason the returning effect had to answer it.
 *
 * All three were pointer-tracked decoration on NON-INTERACTIVE content, a gold
 * wash that followed the cursor across the hero, cards that leaned toward it, grid
 * cells that dimmed their neighbours on hover. They shared four problems:
 *
 *   - They responded to the pointer rather than to the reader. Nothing they
 *     decorated was clickable, so the motion promised an affordance that did not
 *     exist.
 *   - Two of them required `tabIndex={0}` on static <div>s and <article>s purely so
 *     a keyboard could reach the hover branch, which inserted stops in the tab
 *     order that do nothing on arrival. A real accessibility cost for decoration.
 *   - They were invisible to every touch user by design (`hasFinePointer()` gates
 *     all three), so the effort only ever reached desktop pointer users.
 *   - Lift-toward-cursor and dim-the-neighbours are stock effects; combined with
 *     everything else that was here, they were a large part of why the page read
 *     as generated.
 *
 * What is left in this file is interaction on things that ARE interactive: the
 * copy-to-clipboard button, the form fields, the expandable rows, the nav
 * underline, the reading-progress rail. That is the line, motion responds to
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
  | "ledgerMarks"
  | "verifyMarks"

export type Interaction = (root: HTMLElement) => void | (() => void)

/** True for mouse/trackpad. Touch and pen get the static design. */
function hasFinePointer(): boolean {
  return typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches
}

/**
 * The edge a rule should grow FROM, as a `transform-origin` keyword.
 *
 * ── THIS IS THE CORRECTION THE DELETED `axisDirection` NEVER MADE ──────────────
 *
 * The note below records a helper that multiplied x-motion by `(dir === 1 ? 1 : 1)`
 *, both arms identical, so it had never flipped anything. It was removed as dead
 * code, and correctly: its one caller did not need it.
 *
 * A defect was still standing, though a narrower one than it first looks. The
 * STYLESHEET is not at fault: `.hover-rule` and `.field-underline` each already
 * carry a `[dir="rtl"]` mirror flipping `transform-origin` to `right`, and
 * `.band-edge` carries a comment calling that "the footgun those two already
 * carry". The CSS layer had this solved.
 *
 * `formFields` then wrote `transformOrigin: "left"` INLINE: and an inline style
 * outranks a stylesheet rule, so it silently defeated the RTL mirror that was
 * sitting right there. In Arabic the field underline grew from the physical left
 * and travelled rightward: away from where the text starts, against the reading
 * direction, finishing where the reader began. `hoverRule` set no origin at all
 * and was therefore always correct; it is routed through this helper anyway so
 * the next person to add a sweep copies a pattern that cannot regress.
 *
 * THE LESSON IS ABOUT INLINE STYLES, NOT ABOUT ARABIC. A physical-direction
 * constant written from JS bypasses every logical-property defence the stylesheet
 * has, and does it without warning. That is why this returns the resolved edge
 * rather than letting any call site hardcode one.
 *
 * WHY A KEYWORD AND NOT A MULTIPLIER. The dead helper's mistake was reaching for
 * arithmetic. `scaleX` is not signed motion that can be negated; what is wrong is
 * the ANCHOR, so the anchor is what this returns.
 *
 * READ FROM THE DOCUMENT, NOT FROM A PROP. app/layout.tsx sets `dir` on <html>
 * from `isRtl(locale)`, so direction is already in the DOM before any of this
 * runs. Threading a locale down through MotionScope into every interaction would
 * duplicate that fact and create a second one to keep in sync.
 *
 * `closest("[dir]")` rather than reading <html> directly: a subtree can override
 * direction, components/contact-section.tsx and the contact page both pin
 * `dir="ltr"` around phone numbers and the email grid, and a rule inside one of
 * those must follow its own context rather than the page's.
 */
function ruleOrigin(el: Element): "left" | "right" {
  const scope = el.closest("[dir]")
  const dir = scope?.getAttribute("dir") ?? document.documentElement.dir
  return dir === "rtl" ? "right" : "left"
}

/*
 * REMOVED: `axisDirection`, a 1/-1 multiplier for flipping x-axis motion in
 * Arabic.
 *
 * Its only caller was `navUnderline`, where it was multiplied in as
 * `(dir === 1 ? 1 : 1)`, both arms identical, so it had never flipped anything.
 * See the note at that call site for why no correction is needed there.
 *
 * Nothing else wants it. Every piece of motion added since is direction-safe by
 * construction rather than by correction: the ledger rail runs on the block axis
 * (scaleY), the panel reveal is a block-axis clip, and everything positional uses
 * logical properties, which the browser flips without being asked. A helper that
 * exists for a flip nobody performs is a trap, the next person to need an
 * x-axis animation would reach for it and inherit a multiplier rather than
 * writing the logical property that would have been correct.
 */

/** What the Motion `animate()` call hands back. Narrowed to what this file uses. */

/**
 * Collects listeners AND running animations, and returns one function that
 * removes all of them.
 *
 * Every interaction below builds its cleanup through this rather than by hand.
 * Hand-written teardown is where leaks come from: it is easy to add a third
 * listener and forget the matching `removeEventListener`, and nothing fails
 * loudly when you do, the page just gets slower each time it is visited.
 *
 * `track` is the half that is new under Motion. anime.js reverted in-flight
 * animations through the scope; here each one must be stopped explicitly, and
 * routing them through the same collector means a cleanup cannot remove the
 * listeners while leaving an animation still writing to the element.
 */
function listeners() {
  const bound: Array<() => void> = []
  const running = new Set<Handle>()

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
    /** Register an animation so teardown can stop it. Returns it unchanged. */
    track<T extends Handle>(animation: T): T {
      running.add(animation)
      // Drop the handle once it settles, so a long-lived interaction does not
      // accumulate one entry per hover for the life of the page. A stopped
      // animation rejects, which is why both arms are handled.
      animation.then(
        () => running.delete(animation),
        () => running.delete(animation),
      )
      return animation
    },
    cleanup() {
      bound.forEach((off) => off())
      bound.length = 0
      running.forEach((animation) => animation.stop())
      running.clear()
    },
  }
}

export const INTERACTIONS: Record<InteractionName, Interaction> = {
  /**
   * A gold rule draws under a label on hover or focus.
   *
   * Used on the About fact list, where each `dt` already carries a gold label,
   * the rule extends that language rather than introducing a new one.
   */
  hoverRule(root) {
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-interact='rule-item']"))
    if (!items.length) return

    const l = listeners()

    items.forEach((item) => {
      const rule = item.querySelector<HTMLElement>("[data-interact='rule-line']")
      if (!rule) return

      // Anchored to the reading edge, so the rule draws WITH the language rather
      // than against it. See ruleOrigin() for the bug this fixes in Arabic.
      setStyles(rule, { scaleX: 0, transformOrigin: ruleOrigin(rule) })
      const show = () => l.track(animate(rule, { scaleX: 1 }, { duration: DUR.d3, ease: EASE.rule }))
      const hide = () => l.track(animate(rule, { scaleX: 0 }, { duration: DUR.d2, ease: EASE.exit }))

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
        if (rule) setStyles(rule, { scaleX: 1 })
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

      const on = () => l.track(animate(partners, { opacity: 1, scale: 1.03 }, { duration: DUR.d3, ease: EASE.soft }))
      const off = () => l.track(animate(partners, { opacity: 1, scale: 1 }, { duration: DUR.d3, ease: EASE.soft }))

      l.on(el, "pointerenter", on)
      l.on(el, "pointerleave", off)
      l.on(el, "focusin", on)
      l.on(el, "focusout", off)
    })

    return () => {
      l.cleanup()
      setStyles(sources, { scale: 1, opacity: 1 })
    }
  },

  /**
   * Position rows expand to show supplementary detail.
   *
   * WHAT STAYS VISIBLE WHEN COLLAPSED, and this is the whole design of it: the
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
      // without a flash, but only once JS is here to reopen it. Before that it
      // renders open, which keeps the content reachable with no scripting.
      setStyles(panel, { height: 0, opacity: 0, overflow: "hidden" })
      panel.setAttribute("aria-hidden", "true")
      trigger.setAttribute("aria-expanded", "false")

      const toggle = () => {
        const open = trigger.getAttribute("aria-expanded") === "true"
        trigger.setAttribute("aria-expanded", open ? "false" : "true")
        panel.setAttribute("aria-hidden", open ? "true" : "false")

        /*
         * Height is animated in PIXELS and then released to `auto`.
         *
         * Motion cannot interpolate to the keyword `auto`, so the open state
         * animates to the measured `scrollHeight` and the settle handler swaps in
         * `auto`. Without that swap a later reflow, a font load, a viewport
         * change, leaves the panel clipped at a stale pixel value.
         *
         * `.then()` rather than the anime.js `onComplete`: a Motion animation IS a
         * promise. A `.stop()` during teardown rejects it, so the second arm is
         * supplied and does nothing, writing `auto` onto a torn-down panel would
         * be exactly the stale inline value the cleanup is removing.
         */
        const animation = l.track(
          animate(
            panel,
            { height: open ? 0 : panel.scrollHeight, opacity: open ? 0 : 1 },
            { duration: DUR.d4, ease: EASE.out },
          ),
        )

        if (!open) {
          animation.then(
            () => {
              // Re-read the attribute rather than trusting the closure: a second
              // click during the animation flips it, and writing `auto` onto a
              // panel that is now closing would jump it open.
              if (trigger.getAttribute("aria-expanded") === "true") setStyles(panel, { height: "auto" })
            },
            () => {},
          )
        }

        if (chevron) l.track(animate(chevron, { rotate: open ? 0 : 180 }, { duration: DUR.d3, ease: EASE.out }))
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
          setStyles(panel, { height: "auto", opacity: 1, overflow: "visible" })
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
   * The mailto link stays exactly as it was, this is an ADDITIONAL button beside
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
          l.track(animate(idle, { opacity: 0, scale: 0.6 }, { duration: DUR.d2, ease: EASE.exit }))
          l.track(animate(done, { opacity: 1, scale: 1 }, { duration: DUR.d3, ease: EASE.out }))
          timers.push(
            setTimeout(() => {
              l.track(animate(idle, { opacity: 1, scale: 1 }, { duration: DUR.d3, ease: EASE.out }))
              l.track(animate(done, { opacity: 0, scale: 0.6 }, { duration: DUR.d2, ease: EASE.exit }))
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

      if (done) setStyles(done, { opacity: 0, scale: 0.6 })
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

      // `"left"` was hardcoded here, which drew the field underline backwards in
      // Arabic, it grew from the physical left, away from where the text starts.
      setStyles(underline, { scaleX: 0, transformOrigin: ruleOrigin(underline) })

      l.on(input, "focus", () => l.track(animate(underline, { scaleX: 1 }, { duration: DUR.d3, ease: EASE.rule })))
      l.on(input, "blur", () => l.track(animate(underline, { scaleX: 0 }, { duration: DUR.d2, ease: EASE.exit })))
    })

    // Error paragraphs are rendered by React, so they appear after this runs.
    // A MutationObserver animates whichever ones arrive, rather than requiring
    // the form component to call into the animation layer.
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.id.endsWith("-error")) {
            // Keyframe arrays are `[from, to]` in Motion exactly as they were in
            // anime.js, so the from-state stays declared at the call site.
            l.track(animate(node, { opacity: [0, 1], y: [-6, 0] }, { duration: DUR.d3, ease: EASE.out }))
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
        if (underline) setStyles(underline, { scaleX: 0 })
      })
    }
  },

  /**
   * Clicking an enquiry card prefills the form subject and moves focus there.
   *
   * Focus follows the scroll deliberately. A click that scrolls the page but
   * leaves focus behind is disorienting with a screen reader and useless with a
   * keyboard, the point of the interaction is to put you in the form, ready to
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
        // dispatched explicitly, otherwise the field looks filled and submits empty.
        target.dispatchEvent(new Event("input", { bubbles: true }))

        target.scrollIntoView({ behavior: "smooth", block: "center" })
        target.focus({ preventScroll: true })

        /*
         * THE CONFIRMATION WAITS FOR THE SCROLL TO ARRIVE.
         *
         * It used to fire on the same tick as `scrollIntoView`, which meant the
         * one moment that tells the reader their click DID something played out
         * while the field was still off-screen and travelling. By the time the
         * form was in view the pulse had finished, the subject line simply was
         * filled, with nothing to connect it to the row they pressed.
         *
         * `scrollend` is the correct signal and is waited for when the browser
         * has it. Where it does not (Safari at time of writing), the timeout is
         * not a fallback delay but the same guarantee `entrance()` gives with
         * ENTRANCE_DEADLINE: the confirmation plays regardless, slightly early
         * rather than never. Whichever lands first cancels the other, so it can
         * never run twice.
         */
        let fired = false
        const confirm = () => {
          if (fired) return
          fired = true
          clearTimeout(deadline)
          document.removeEventListener("scrollend", confirm)

          l.track(animate(target, { scale: [1.015, 1] }, { duration: DUR.d4, ease: EASE.out }))

          // The field states the change; the pulse alone reads as a focus ring.
          target.setAttribute("data-prefilled", "")
          const clear = setTimeout(() => target.removeAttribute("data-prefilled"), 1400)
          l.on(window, "beforeunload", () => clearTimeout(clear))
        }

        const deadline = setTimeout(confirm, 700)
        document.addEventListener("scrollend", confirm, { once: true })
      })
    })

    return () => {
      l.cleanup()
      // A teardown mid-confirmation must not leave the field permanently lit.
      document
        .querySelectorAll("[data-prefilled]")
        .forEach((el) => el.removeAttribute("data-prefilled"))
    }
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

    const spans = links
      .map((a) => a.querySelector<HTMLElement>("span"))
      .filter((s): s is HTMLElement => s !== null)
    setStyles(spans, { opacity: 0 })

    const moveTo = (el: HTMLElement | null) => {
      const active = el ?? nav.querySelector<HTMLElement>('a[aria-current="page"]')
      if (!active) {
        l.track(animate(bar, { opacity: 0 }, { duration: DUR.d2 }))
        return
      }
      const navRect = nav.getBoundingClientRect()
      const rect = active.getBoundingClientRect()
      l.track(
        animate(
          bar,
          {
            opacity: 1,
            width: rect.width,
            /*
             * Measured from the nav's own box, which is what makes this correct in
             * both directions with no branch at all.
             *
             * THERE USED TO BE A DIRECTION MULTIPLIER HERE AND IT DID NOTHING:
             * `* (dir === 1 ? 1 : 1)`, both arms were 1. The `dir` it read was
             * computed one scope up and used nowhere else, so the code claimed an
             * RTL correction it never applied, and anyone maintaining the nav would
             * have trusted a guard that was not there.
             *
             * No correction is needed. getBoundingClientRect is viewport-absolute
             * and `left` is a physical edge in both directions, so the delta between
             * the link's left edge and the nav's left edge is already the distance
             * from the bar's own inset-inline-start origin, in Arabic the links are
             * laid out right-to-left, but both rects move with them and the
             * subtraction stays true.
             */
            x: rect.left - navRect.left,
          },
          { duration: DUR.d3, ease: EASE.out },
        ),
      )
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
      // Restore the per-item underlines, without this a teardown leaves the nav
      // with no visible active state at all.
      setStyles(spans, { opacity: 1 })
      setStyles(bar, { opacity: 0 })
    }
  },

  /**
   * A role card's ordinal firms up while the card is hovered or focused.
   *
   * ── WHY THIS IS NOT `gridNeighbours` COMING BACK ───────────────────────────
   *
   * The effect removed under that name DIMMED the other cells, it made content
   * harder to read as a side effect of pointing at something, which is a cost
   * paid by everything the reader was not looking at. This touches ONLY the row
   * under the pointer and dims nothing: the neighbours are exactly as legible
   * while a card is hovered as they are when nothing is.
   *
   * ── AND WHY THE TARGET IS THE MARK, NOT THE CARD ───────────────────────────
   *
   * The card is a static <article>; it is not clickable and must not offer an
   * affordance it cannot honour. The margin mark is ALREADY on the card, and
   * extending it is the same gesture as the rule that draws under a fact label,
   * emphasis added to something already visible.
   *
   * IT EXTENDS RATHER THAN BRIGHTENING. The target used to be the card's ordinal,
   * lifted from 0.55 to 0.85 opacity; with a figure that was the only move
   * available, because a number cannot get longer. A stroke can, and a mark that
   * grows when you point at a row is the gesture a reader recognises, the pen
   * pressed a little further along the margin. `scaleX` runs from the leading
   * origin the stylesheet already set, so it lengthens away from the card's edge
   * in both directions, and it composites on the GPU where an opacity ramp on
   * seven stacked elements did not.
   *
   * Bound to focusin/focusout as well as the pointer, per the rules at the top
   * of this file. The rows are not given `tabIndex`: they contain a focusable
   * link where there is one, and adding a tab stop to a static card is the
   * accessibility cost the removal note above objects to.
   */
  ledgerMarks(root) {
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-anime='rail-item']"))
    if (!rows.length) return

    const l = listeners()

    rows.forEach((row) => {
      const mark = row.querySelector<HTMLElement>(".mark-card")
      if (!mark) return

      const on = () => l.track(animate(mark, { scaleX: 1.6 }, { duration: DUR.d1, ease: EASE.soft }))
      const off = () => l.track(animate(mark, { scaleX: 1 }, { duration: DUR.d2, ease: EASE.exit }))

      l.on(row, "pointerenter", on)
      l.on(row, "pointerleave", off)
      l.on(row, "focusin", on)
      l.on(row, "focusout", off)
    })

    return () => {
      l.cleanup()
      // Back to the resting length the stylesheet declares, not to whatever the
      // last hover left behind.
      rows.forEach((row) => {
        const mark = row.querySelector<HTMLElement>(".mark-card")
        if (mark) setStyles(mark, { scaleX: 1 })
      })
    }
  },

  /**
   * The verification mark draws itself beside a row whose register entry is confirmed.
   *
   * ── THIS IS THE ONE PIECE OF MOTION HERE THAT CARRIES INFORMATION ──────────────
   *
   * Everything else in this file decorates something the reader can act on. This
   * one states a FACT that the page otherwise keeps to itself.
   *
   * `data/positions.json` records `registerConfirmed` per row, and lib/verification.ts
   * enforces a tier system on top of it, tier A is "verifiable in a public
   * register", tier B is "real organisation, role confirmed by the client, limited
   * public record". Those are genuinely different claims, and until now the page
   * rendered them identically. A site whose entire argument is "every number is
   * counted, not claimed" was not showing the reader which entries it had actually
   * counted.
   *
   * ── WHAT EACH STATE LOOKS LIKE, AND WHY ────────────────────────────────────────
   *
   *   CONFIRMED  a rule strokes out to full width, then a tick draws in above it.
   *              A closed, finished shape, the mark completes.
   *   PENDING    a shorter rule strokes out and STOPS. No tick, and the line is
   *              left open-ended. Nothing is drawn that implies completion,
   *              because nothing has been completed.
   *
   * The pending state deliberately is NOT a warning colour or a cross. This is not
   * a defect being reported, intake section 4 records these as "تُزوَّد لاحقًا",
   * supplied later, and marking a pending row in red would misrepresent an
   * ordinary approval queue as a problem with the subject.
   *
   * ── THE MOTION IS NOT WHAT CARRIES THE MEANING ─────────────────────────────────
   *
   * This is the rule that kept the effect admissible. The mark and its label are in
   * the server-rendered markup, at their final state, before any of this runs. The
   * animation draws attention to a distinction that is already legible; it does not
   * ENCODE the distinction. A reader with no JS, with reduced motion, or with a
   * screen reader gets the same information from the `<title>` on the mark and the
   * visually-hidden text beside it, which is why `MotionScope`'s reduced-motion
   * branch can simply skip this with nothing lost.
   *
   * `inView` with no return value: fires once, never replays.
   */
  verifyMarks(root) {
    const marks = Array.from(root.querySelectorAll<HTMLElement>("[data-verify]"))
    if (!marks.length) return

    const l = listeners()
    const stops: Array<() => void> = []

    marks.forEach((mark, i) => {
      const confirmed = mark.getAttribute("data-verify") === "confirmed"
      const rule = mark.querySelector<SVGPathElement>("[data-verify-rule]")
      const tick = mark.querySelector<SVGPathElement>("[data-verify-tick]")
      if (!rule) return

      /*
       * STROKE-DASH DRAWING, measured from the path itself.
       *
       * `getTotalLength()` rather than a hardcoded number: these are short paths
       * whose length depends on the viewBox, and a literal would silently desync
       * the moment the mark is resized. Setting dasharray and dashoffset to the
       * same value hides the stroke completely; animating the offset to 0 draws it.
       *
       * Written synchronously, for the same reason hero.ts writes its from-states
       * synchronously, a hide that lands a frame late shows the finished mark and
       * then blanks it.
       */
      const prepare = (path: SVGPathElement) => {
        const length = path.getTotalLength()
        path.style.strokeDasharray = `${length}`
        path.style.strokeDashoffset = `${length}`
        return length
      }

      prepare(rule)
      if (tick) prepare(tick)

      const stop = inView(
        mark,
        () => {
          // The rule draws first and the tick follows it, so the mark reads as
          // being made rather than appearing. `ease: rule` is the curve the rest
          // of the site's sweeps use.
          l.track(
            animate(
              rule,
              { strokeDashoffset: 0 },
              { duration: DUR.d4, delay: i * 0.09, ease: EASE.rule },
            ) as unknown as Handle,
          )

          if (confirmed && tick) {
            l.track(
              animate(
                tick,
                { strokeDashoffset: 0 },
                { duration: DUR.d3, delay: i * 0.09 + DUR.d4 * 0.75, ease: EASE.out },
              ) as unknown as Handle,
            )
          }
        },
        { amount: 0.8 },
      )
      stops.push(stop)
    })

    return () => {
      stops.forEach((stop) => stop())
      l.cleanup()
      /*
       * Every mark is left FULLY DRAWN, never at its hidden from-state.
       *
       * Same reasoning as `hoverRule`'s cleanup: if teardown lands mid-draw, a
       * complete mark is the harmless end state and a half-drawn or invisible one
       * is not. Here it is stronger than a taste argument, an invisible mark would
       * remove the verification signal from a row that has earned it.
       */
      marks.forEach((mark) => {
        mark.querySelectorAll<SVGPathElement>("path").forEach((path) => {
          path.style.strokeDasharray = ""
          path.style.strokeDashoffset = ""
        })
      })
    }
  },
}
