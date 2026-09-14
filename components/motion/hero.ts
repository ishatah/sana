import { animate, stagger, utils } from "animejs"

/**
 * The hero's motion, and the only motion left on the page that is not driven by a
 * click.
 *
 * ── WHY THIS IS NOT THE SCROLL MOTION THAT WAS REMOVED ─────────────────────────
 *
 * Every animation here fires ONCE, on load, from a known state. None of it is
 * triggered by scrolling, none of it observes the viewport, and none of it runs on
 * a loop. That distinction is the whole design: the scroll-triggered entrances and
 * the one-section-per-gesture controller were removed because they took the page
 * away from the reader, and nothing in this file can do that — by the time a
 * visitor has scrolled at all, everything here has finished and will not run again.
 *
 * ── THE FLOOR ──────────────────────────────────────────────────────────────────
 *
 * The hero is fully readable with this file absent, failed, or refused. The markup
 * ships complete and visible from the server; these animations only ADD a starting
 * offset and then remove it. That ordering matters and is the opposite of how
 * entrance animations are usually built: the common pattern hides elements in CSS
 * and reveals them in JS, which renders a blank hero whenever the JS does not
 * arrive. Here the from-state is written by the same code that animates it away, so
 * a bundle that never loads leaves the content exactly where it already was.
 */

/** How far each element travels on entry. Small on purpose — a long slide reads as
 *  a page assembling itself, which is the template effect this avoids. */
const RISE = 18

/**
 * The order the hero assembles in, and the reason it is this order.
 *
 * It follows READING order, not visual weight: the eyebrow names the subject, the
 * name lands, the role qualifies it, the rule closes the block, the title and the
 * detail follow, and the CTAs arrive last because an action offered before its
 * context is an advert. The portrait fades in alongside the name rather than after
 * everything else — it is the other half of the same statement.
 */
const SEQUENCE: Array<{ selector: string; at: number }> = [
  { selector: '[data-anime="eyebrow"]', at: 0 },
  { selector: '[data-anime="name"]', at: 90 },
  { selector: '[data-anime="role-lead"]', at: 210 },
  { selector: '[data-anime="hero-rule"]', at: 320 },
  { selector: '[data-anime="hero-title"]', at: 390 },
  // One hook where there were three. The roles list, the stat bar and the
  // locations list were separate blocks with separate entrances; they are now a
  // single meta row, so they arrive together as one object rather than as three
  // things queueing up.
  { selector: '[data-anime="hero-meta"]', at: 480 },
  { selector: '[data-anime="hero-cta"]', at: 580 },
]

/**
 * Mounts every hero behaviour. Returns a teardown that reverts each one.
 *
 * The caller (components/motion/hero-scope.tsx) is responsible for the
 * reduced-motion check — this is never called when the visitor has asked for less
 * motion, so nothing here needs its own guard.
 */
export function mountHero(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = []

  cleanups.push(entrance(root))
  cleanups.push(shimmer(root))
  cleanups.push(rotateRoles(root))

  return () => cleanups.forEach((fn) => fn())
}

/**
 * The staggered entrance.
 *
 * `utils.set` writes the from-state immediately and synchronously, then each
 * element animates back to rest. Because this runs in an effect — after first
 * paint — there is a frame where the content is already at its final position, and
 * that is the correct trade: a brief correct state is better than a hidden one, and
 * it is what guarantees the no-JS floor described at the top of this file.
 */
function entrance(root: HTMLElement): () => void {
  const targets: Element[] = []

  for (const { selector, at } of SEQUENCE) {
    const els = Array.from(root.querySelectorAll(selector))
    if (!els.length) continue
    targets.push(...els)

    utils.set(els, { opacity: 0, translateY: RISE })
    animate(els, {
      opacity: 1,
      translateY: 0,
      duration: 760,
      /*
       * The parameters are OPTIONAL, and that is not cosmetic. anime.js types a
       * function-valued tween param as `FunctionValue`, whose signature is
       * `(target?, index?, targets?, prevTween?)`. Declaring them as required
       * makes the function fail to match, TypeScript falls through to the next
       * member of the union — `EasingParam` — and reports the confusing
       * "Target signature provides too few arguments" against an easing type this
       * line has nothing to do with.
       */
      delay: (_target?: unknown, i?: number) => at + (i ?? 0) * 70,
      // A long, decelerating ease. The motion is almost over by the time the eye
      // reaches it, so what registers is the settle rather than the travel.
      ease: "out(3)",
    })
  }

  const figure = root.querySelector('[data-hero="portrait"]')
  if (figure) {
    targets.push(figure)
    // The portrait scales from slightly large rather than small: a figure growing
    // into place reads as a UI element appearing, while one settling back from a
    // push-in reads as a camera coming to rest.
    utils.set(figure, { opacity: 0, scale: 1.04 })
    animate(figure, { opacity: 1, scale: 1, duration: 1100, delay: 120, ease: "out(3)" })
  }

  const glow = root.querySelector('[data-hero="portrait-glow"]')
  if (glow) {
    targets.push(glow)
    utils.set(glow, { opacity: 0 })
    animate(glow, { opacity: 1, duration: 1600, delay: 240, ease: "out(2)" })
  }

  /*
   * Teardown clears the inline styles this wrote rather than reversing the
   * animation. Anything left behind — an opacity, a transform — would be a value
   * the stylesheet no longer controls, and on a client-side navigation back to this
   * page it would fight the fresh mount.
   */
  return () => utils.remove(targets)
}

/**
 * One champagne highlight travelling across the name.
 *
 * IT RUNS ONCE AND STOPS. A looping shimmer is the single clearest "premium
 * template" tell — it turns a person's name into signage. Fired once as the name
 * lands, it reads instead as light catching a surface, and then the name is simply
 * set in the heading colour like any other heading.
 *
 * The effect is a background-clipped gradient, so it costs no extra element and
 * cannot be read by a screen reader. The name text is the real text throughout: it
 * is never split into per-character spans, which is the rule this site keeps for
 * any rendering of a real person's name.
 */
function shimmer(root: HTMLElement): () => void {
  const name = root.querySelector<HTMLElement>('[data-anime="name"]')
  if (!name) return () => {}

  const RESTORE = {
    backgroundImage: name.style.backgroundImage,
    backgroundSize: name.style.backgroundSize,
    backgroundPosition: name.style.backgroundPosition,
    backgroundRepeat: name.style.backgroundRepeat,
  }

  /*
   * The gradient is mostly the heading colour with a narrow champagne band in the
   * middle, and it is sized at 220% so that band can travel the full width of the
   * text without either end of the gradient entering the frame.
   */
  name.style.backgroundImage =
    "linear-gradient(100deg, var(--heading) 38%, var(--primary-hover) 48%, var(--primary) 52%, var(--heading) 62%)"
  name.style.backgroundSize = "220% 100%"
  name.style.backgroundRepeat = "no-repeat"
  name.style.backgroundPosition = "120% 0"
  name.style.setProperty("-webkit-background-clip", "text")
  name.style.setProperty("background-clip", "text")
  name.style.setProperty("-webkit-text-fill-color", "transparent")

  const anim = animate(name, {
    backgroundPosition: ["120% 0", "-40% 0"],
    duration: 1500,
    delay: 420,
    ease: "inOut(2)",
    /*
     * THE CLIP IS REMOVED WHEN THE SWEEP ENDS, and that is a correctness fix rather
     * than tidiness. `-webkit-text-fill-color: transparent` means the glyphs are
     * painted only by the background; if anything later repaints that background —
     * a theme change, a print stylesheet, a browser that drops background-clip —
     * the name renders as invisible text. Restoring the normal fill the moment the
     * animation is done means the failure window is 1.5 seconds rather than the
     * life of the page.
     */
    onComplete: () => restore(),
  })

  function restore() {
    name!.style.removeProperty("-webkit-text-fill-color")
    name!.style.removeProperty("-webkit-background-clip")
    name!.style.removeProperty("background-clip")
    name!.style.backgroundImage = RESTORE.backgroundImage
    name!.style.backgroundSize = RESTORE.backgroundSize
    name!.style.backgroundPosition = RESTORE.backgroundPosition
    name!.style.backgroundRepeat = RESTORE.backgroundRepeat
  }

  return () => {
    anim.revert()
    restore()
  }
}

/**
 * The role line cycles through her supplied roles.
 *
 * ── THIS IS NOT THE TYPEWRITER THAT WAS REMOVED, AND THE DIFFERENCES ARE THE
 *    REASONS IT IS ACCEPTABLE ────────────────────────────────────────────────────
 *
 * The original hero ran jQuery.typed: the roles were typed in and deleted one
 * character at a time under a blinking cursor. It was removed for four documented
 * reasons, and this rebuild answers each of them rather than ignoring them:
 *
 *   1. IT UNDERMINED THE CONTENT. Typing a title letter by letter presents it as ad
 *      copy. A crossfade does not perform the text; it changes which of several
 *      true statements is on screen, the way a caption changes.
 *
 *   2. IT WAS THE PAGE'S <h1>. The heading was whatever had been typed at the
 *      moment a screen reader read it — sampled live, it announced "Civil Societ".
 *      HERE THE <h1> IS THE NAME AND IS NEVER TOUCHED. This animates a <p> beneath
 *      it.
 *
 *   3. IT FORCED AN ACCESSIBILITY WORKAROUND — a visually-hidden true title plus
 *      `aria-hidden` on the animation. Instead this element is marked
 *      `aria-hidden` and the COMPLETE list of roles is rendered beside it in the
 *      markup for assistive technology, so nothing is announced mid-word and
 *      nothing is announced twice.
 *
 *   4. IT COST A CLIENT COMPONENT. It still does — but one client boundary now
 *      serves the whole hero rather than being spent on this alone.
 *
 * Every string comes from `headline.rotatingRoles`, which is supplied intake data.
 * No role is invented, abbreviated or reordered here.
 */
function rotateRoles(root: HTMLElement): () => void {
  const line = root.querySelector<HTMLElement>('[data-anime="role-lead"]')
  if (!line) return () => {}

  const raw = line.getAttribute("data-roles")
  const roles = raw ? (JSON.parse(raw) as string[]) : []
  // Nothing to cycle between: one role is a statement, not a rotation.
  if (roles.length < 2) return () => {}

  let index = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  /*
   * 2 seconds on screen, and the crossfade is tightened to match.
   *
   * These are two-word titles — "Business Development", "Strategic Partnerships"
   * — so the read is quick and a long hold reads as a stall rather than as calm.
   * The transition durations below were sized for the old 4.2s cadence; left
   * alone they would eat almost half of a 2s cycle and the line would spend more
   * time moving than resting, which is the thing that actually makes a rotating
   * headline feel frantic.
   *
   * HOLD is the time the text is STILL. The cycle is HOLD plus the two tween
   * durations, so the visible rhythm is roughly 2.6s per role.
   */
  const HOLD = 2000

  const step = () => {
    if (stopped) return
    index = (index + 1) % roles.length

    animate(line, {
      opacity: [1, 0],
      translateY: [0, -8],
      duration: 240,
      ease: "in(2)",
      onComplete: () => {
        if (stopped) return
        line.textContent = roles[index]
        animate(line, {
          opacity: [0, 1],
          translateY: [8, 0],
          duration: 320,
          ease: "out(3)",
        })
      },
    })

    timer = setTimeout(step, HOLD)
  }

  // The first change waits a full hold plus the entrance, so the role the page
  // loaded with is the one a visitor actually reads first.
  timer = setTimeout(step, HOLD + 600)

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    // Restore the first role: whatever is in the DOM on teardown would otherwise
    // become the server/client mismatch on the next mount.
    line.textContent = roles[0]
    utils.remove(line)
  }
}

/*
 * THE PORTRAIT NO LONGER FOLLOWS THE POINTER.
 *
 * A `parallax()` here drifted the figure up to 10px against the cursor, with the
 * glow behind it displacing further to sell depth. It was small and it was
 * smooth, and it was still wrong for this page: the subject of the photograph is
 * a person, and tying her to the cursor makes her an element of the interface
 * rather than the person the page is about. Every movement then reads as the
 * site responding to the visitor, which is the opposite of the register intake
 * section 3 asks for ("رسمي · قيادي", and no "عناصر حركية زائدة").
 *
 * The entrance animation stays — that plays once, on arrival, and settles. What
 * is gone is the part that never settled.
 */

