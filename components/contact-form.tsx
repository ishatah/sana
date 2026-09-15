"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { AnimatePresence, m, useReducedMotion, useTransform } from "motion/react"
import { INTERACTIONS } from "@/components/motion/interactions"
import { FmRoot } from "@/components/motion/fm/fm-root"
import { useScrubReveal } from "@/components/motion/fm/use-scrub-reveal"

type Errors = Partial<Record<"name" | "email" | "message", string>>

/**
 * The contact form. Posts to /api/contact.
 *
 * The template ships a PHP mailer plus reCAPTCHA with the site key left as
 * "copy-your-site-key-here", which renders a broken widget on a live page. Neither
 * is carried over: the endpoint is a Route Handler, and spam is handled by the
 * honeypot below plus rate limiting server-side.
 *
 * Validation runs on both sides. This pass exists for the visitor, instant, in
 * their language, no round trip, and the API re-validates independently, because
 * a client-side check is a convenience and never a control.
 */
export function ContactForm() {
  const t = useTranslations("contact.form")
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [errors, setErrors] = useState<Errors>({})
  const formRef = useRef<HTMLFormElement>(null)
  /** Cleared on unmount so a resolved send cannot set state on a gone form. */
  const sentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(sentTimer.current), [])

  /**
   * Field focus states and animated validation.
   *
   * Called directly rather than through `MotionScope` for the same reason the nav
   * is: this is already a client component, and the contact page's section scope
   * is carrying `copyEmail`, a scope takes one interaction, and the form is the
   * better owner of its own behaviour than the section wrapping it.
   *
   * The reduced-motion check is explicit here because the scope's `mediaQueries`
   * guard is not in play.
   */
  useEffect(() => {
    const form = formRef.current
    if (!form) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const cleanup = INTERACTIONS.formFields(form)
    return () => cleanup?.()
  }, [])

  const validate = (form: FormData): Errors => {
    const next: Errors = {}
    const name = String(form.get("name") ?? "").trim()
    const email = String(form.get("email") ?? "").trim()
    const message = String(form.get("message") ?? "").trim()

    if (!name) next.name = t("required")
    if (!email) next.email = t("required")
    // Deliberately permissive. The only thing worth rejecting here is a value that
    // cannot be an address at all; anything stricter starts rejecting real
    // addresses, and this form's job is to let people through.
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t("invalidEmail")
    if (!message) next.message = t("required")

    return next
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    /*
     * CAPTURED BEFORE THE AWAIT, NOT READ AFTER IT.
     *
     * React pools nothing here, but `currentTarget` is nulled once the event
     * handler returns, and this handler returns at the first `await`. The
     * previous `e.currentTarget.reset()` ran after the fetch had resolved and
     * would throw on a null target; it survived only because the line above it
     * had already made the success path unreachable.
     */
    const form_el = e.currentTarget
    const form = new FormData(form_el)

    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setState("sending")
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      })
      if (!res.ok) throw new Error("send failed")
      /*
       * THE SENT STATE IS ALLOWED TO EXIST.
       *
       * `setState("sent")` was immediately followed by `setState("idle")` in the
       * same synchronous block, so React collapsed both into one render and the
       * state never reached the DOM, the form's single most important moment
       * was unreachable code, and the only confirmation was a toast that appears
       * away from the form the reader is looking at.
       *
       * It is held for long enough to be read and then returns to idle, so the
       * form is usable again without a reload.
       */
      form_el.reset()
      setState("sent")
      toast.success(t("success"))
      sentTimer.current = setTimeout(() => setState("idle"), 3200)
    } catch {
      setState("idle")
      toast.error(t("error"))
    }
  }

  const field = (name: keyof Errors) =>
    errors[name] ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {}

  return (
    <FmRoot>
      <FormBody
        formRef={formRef}
        onSubmit={onSubmit}
        state={state}
        errors={errors}
        field={field}
        t={t}
      />
    </FmRoot>
  )
}

/**
 * The form markup, with each row revealed on a shared scroll scrub.
 *
 * ── WHY THE ROWS SHARE ONE `useScroll` INSTEAD OF WRAPPING EACH IN `ScrollReveal` ──
 *
 * `ScrollReveal` mounts its own `useScroll` and its own spring per element. Seven
 * rows would be seven scroll subscriptions and seven springs driving one short
 * form that crosses the viewport as a single object, and each row's window would
 * be measured against ITS OWN box, so a 40px input and a 140px textarea would
 * resolve at visibly different rates despite sitting in the same block.
 *
 * One scrub on the FORM, with each row offset by `delay`, gives the whole thing a
 * single window and a genuine cascade. It is the same argument
 * ./motion/fm/mark-rail.tsx makes for driving a list of marks from one observer
 * rather than one each.
 *
 * ── SPLIT INTO ITS OWN COMPONENT BECAUSE OF THE RULES OF HOOKS ────────────────
 *
 * `useScrubReveal` must run inside `FmRoot`'s tree for `m.*` to resolve under
 * `LazyMotion strict`, and `FmRoot` cannot wrap a hook call in the same function
 * body that makes it. A child component is the ordinary way to get a hook beneath
 * a provider.
 */
function FormBody({
  formRef,
  onSubmit,
  state,
  errors,
  field,
  t,
}: {
  formRef: React.RefObject<HTMLFormElement | null>
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  state: "idle" | "sending" | "sent"
  errors: Errors
  field: (name: keyof Errors) => Record<string, unknown>
  t: ReturnType<typeof useTranslations>
}) {
  /*
   * The scrub is measured against the form itself, and `exit` is off: a form the
   * reader has scrolled to is a form they are about to type into, and releasing
   * its fields as they move toward the top would animate the control under the
   * cursor. ./motion/fm/use-scrub-reveal.ts states the general rule.
   */
  const { progress, reduced } = useScrubReveal(formRef as React.RefObject<HTMLElement | null>)

  /*
   * THE SSR GUARD, the same one ../motion/fm/scroll-reveal.tsx carries, and for
   * the same measured reason.
   *
   * Framer serialises a MotionValue's current value into the server HTML's style
   * attribute. A reveal's value at scroll progress 0 is the HIDDEN state, so
   * without this the form would ship as `style="opacity:0"` and a bundle that
   * failed to load would leave the contact form permanently invisible, on the
   * page whose entire purpose is being contacted.
   *
   * `armed` is false on the server and on the first client render, so what ships
   * is the resolved state. Read the ⚠️ block in scroll-reveal.tsx before changing
   * this; the `.no-js` floor in styles/globals.css does NOT cover the failure.
   */
  const [armed, setArmed] = useState(false)
  useEffect(() => setArmed(true), [])
  const live = armed && !reduced

  /*
   * EFFECT 34, the success flush. The underline sweeps to --success once the
   * form reports sent, driven by data-submitted rather than by a class swap so
   * the transition has something to interpolate from.
   *
   * COLOUR IS NOT THE MESSAGE HERE, which is what keeps it inside 1.4.1: the
   * form already renders a text confirmation on success (and a toast), and this
   * is decoration on top of that. If the flush were the only signal, a reader
   * who cannot distinguish the green would have no confirmation at all.
   *
   * EFFECT 15 (label colour on focus) IS NOT APPLIED, and it is unapplicable
   * rather than declined. Every label in this form is `sr-only`, visually
   * hidden and present only for the accessibility tree, so there is no visible
   * label to recolour. Recolouring one would change nothing on screen and would
   * be a pure no-op in the DOM. The placeholder carries the visible labelling,
   * and placeholders are not selectable by :focus-within on the wrapper.
   */
  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="success-flush space-y-4"
      data-submitted={state === "sent"}
    >
      {/*
        Honeypot. Hidden from sight and from the accessibility tree, and skipped in
        the tab order, so no human fills it in, a submission that carries a value
        here is discarded server-side. `hidden` rather than an off-screen position:
        some bots read computed styles, and this costs nothing either way.
      */}
      <input type="text" name="company_website" tabIndex={-1} autoComplete="off" aria-hidden hidden />

      <Row progress={progress} live={live} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="sr-only">
            {t("name")}
          </label>
          <input id="name" name="name" className="field-input" placeholder={t("name")} {...field("name")} />
          <FieldError id="name-error" message={errors.name} />
        </div>

        <div>
          <label htmlFor="email" className="sr-only">
            {t("email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            className="field-input"
            placeholder={t("email")}
            {...field("email")}
          />
          <FieldError id="email-error" message={errors.email} />
        </div>
      </Row>

      <Row progress={progress} live={live} delay={0.08} data-interact="field">
        <label htmlFor="organisation" className="sr-only">
          {t("organisation")}
        </label>
        <input id="organisation" name="organisation" className="field-input" placeholder={t("organisation")} />
        <span aria-hidden className="field-underline" data-interact="field-underline" />
      </Row>

      {/*
        The subject field exists so the enquiry cards on /contact have something to
        prefill, clicking "Investors" writes it here and focuses it.

        It was previously absent even though messages carried a `subject` label and
        the API already accepts the field, so the enquiry interaction had no target
        and the visitor had no way to say what they were writing about.
      */}
      <Row progress={progress} live={live} delay={0.16} data-interact="field">
        <label htmlFor="subject" className="sr-only">
          {t("subject")}
        </label>
        <input id="subject" name="subject" className="field-input" placeholder={t("subject")} />
        <span aria-hidden className="field-underline" data-interact="field-underline" />
      </Row>

      <Row progress={progress} live={live} delay={0.24}>
        <label htmlFor="message" className="sr-only">
          {t("message")}
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          className="field-input resize-none"
          placeholder={t("message")}
          {...field("message")}
        />
        <FieldError id="message-error" message={errors.message} />
      </Row>

      <Row progress={progress} live={live} delay={0.32}>
        <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">{t("consent")}</p>
      </Row>

      <Row progress={progress} live={live} delay={0.4}>
        <button
          type="submit"
          disabled={state === "sending" || state === "sent"}
          data-state={state}
          className="btn-main btn-submit disabled:opacity-60"
        >
        {/*
          A CSS RING REPLACES THE <Loader2> SPINNER, and the <Send> arrow is gone
          entirely, both were SVG.

          The spinner stays because it is the only thing that distinguishes "the
          click registered" from "nothing happened" during the request; a border
          with three sides in the current colour and one transparent, spun by
          `animate-spin`, is the same mark the glyph drew. The send arrow was
          decoration beside a button that already reads "Send", so nothing
          replaces it.
        */}
        {state === "sending" && (
          <span
            aria-hidden
            className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {/*
          THE SENT MARK IS THE SAME CSS TICK THE COPY BUTTON USES, not a new
          glyph and not an icon import, see `.copy-icon` in contact-section.tsx.
          A form that confirms itself with the mark the rest of the page already
          uses for "done" is stating the outcome in the site's own vocabulary.
        */}
        {state === "sent" && (
          <span aria-hidden className="submit-tick">
            <span className="block h-[11px] w-[6px] border-b-2 border-r-2 border-current" />
          </span>
        )}
        <span className="submit-label">
          {/*
            `sentShort` on the BUTTON, `success` in the toast. They are the same
            event told at two lengths, and the difference is not stylistic: the
            toast is a sentence because it is read on its own, away from the
            form, and must say what happened and what follows. The button sits
            where "Send Message" just sat, and a control that grows into a full
            sentence on click shoves the layout below it down the page.
          */}
          {state === "sending" ? t("sending") : state === "sent" ? t("sentShort") : t("send")}
        </span>
        </button>
      </Row>
    </form>
  )
}

/**
 * One form row, revealed on the shared scrub with its own offset in the cascade.
 *
 * ── THE `delay` IS A WINDOW SHIFT, NOT A TIMER ────────────────────────────────
 *
 * There is no clock here to delay against, the playhead is scroll position. So a
 * later row is given a later slice of the same window and reaches full opacity at
 * a later scroll offset. That is what makes the cascade reverse correctly when the
 * reader scrolls back up, which a time-based stagger cannot do.
 *
 * Clamped at 0.55 so the last row still completes inside its own window. An
 * unresolved row is an invisible form field, which is the one failure that would
 * matter here.
 */
function Row({
  children,
  progress,
  live,
  delay = 0,
  className,
  ...rest
}: {
  children: React.ReactNode
  progress: import("motion/react").MotionValue<number>
  /**
   * The scrub may write to this element: the bundle is running AND the visitor
   * has not asked for less motion. False collapses every range to the resolved
   * state, see the SSR guard in `FormBody` and the ⚠️ block in
   * ../motion/fm/scroll-reveal.tsx.
   */
  live: boolean
  delay?: number
  className?: string
  /*
   * `data-interact="field"` passes through here, and the spread is load-bearing.
   *
   * ../motion/interactions.ts `formFields` selects on that attribute to wire the
   * focus underline. This component replaced the plain `<div>` that used to carry
   * it, so without the spread the attribute is silently dropped, the recipe
   * matches zero elements and the underline simply never appears, no error,
   * nothing in the console. ../reveal.tsx carries a note about the identical
   * failure for the identical reason.
   */
  [key: string]: unknown
}) {
  const shifted = useTransform(progress, [Math.min(delay, 0.55), 1], [0, 1], { clamp: true })
  const opacity = useTransform(shifted, [0, 0.7], live ? [0, 1] : [1, 1], { clamp: true })
  const y = useTransform(shifted, [0, 1], live ? [14, 0] : [0, 0])

  return (
    <m.div
      data-fm
      className={className}
      style={{ opacity, y, willChange: live ? "transform, opacity" : undefined }}
      {...rest}
    >
      {children}
    </m.div>
  )
}

/**
 * A validation message that ARRIVES rather than appears.
 *
 * ── WHY THIS IS NOT JUST A FADE ───────────────────────────────────────────────
 *
 * The error used to be a bare `{errors.x && <p>}`, which mounts at full opacity
 * on the same frame the layout below it jumps down. A message that pops reads as
 * a rendering fault, the reader's first impression is that something broke, not
 * that they missed a field. Animating the HEIGHT as well as the opacity is what
 * separates the two: the row makes space for the message and the message moves
 * into it, so the shift is the point rather than a side effect.
 *
 * `height: auto` is animatable here because Motion measures the target and
 * interpolates to the resolved pixel value; a raw CSS transition to `auto` would
 * do nothing at all. That is the whole reason this is a Motion component and not
 * another line in globals.css.
 *
 * ── IT IS ANNOUNCED THE INSTANT IT EXISTS, NOT WHEN THE ANIMATION ENDS ────────
 *
 * The node is always mounted while there is a message, and `role="alert"` fires
 * on insertion. Nothing about the reveal is gated behind the animation finishing,
 * so a screen reader reaches the text at the same moment a sighted reader does.
 * `aria-describedby` on the field already points at this `id`, see `field()`.
 *
 * Reduced motion gets the same node with no transition, via `initial={false}`
 * being irrelevant to a zero-duration transition: `useReducedMotion` collapses
 * the durations rather than removing the element, so the message is never lost.
 */
function FieldError({ id, message }: { id: string; message?: string }) {
  const reduced = useReducedMotion()

  return (
    <AnimatePresence initial={false}>
      {message && (
        <m.p
          key="error"
          id={id}
          role="alert"
          /*
           * `overflow: hidden` is what makes the height animation read as the
           * text being uncovered rather than as a paragraph being squashed,
           * without it the message paints at full size from the first frame and
           * spills out of the collapsing box.
           */
          className="overflow-hidden text-xs text-[color:var(--danger)]"
          initial={{ height: 0, opacity: 0, marginTop: 0 }}
          animate={{ height: "auto", opacity: 1, marginTop: 6 }}
          exit={{ height: 0, opacity: 0, marginTop: 0 }}
          transition={
            reduced
              ? { duration: 0 }
              : // Arriving is slower than leaving, the asymmetry the `--dur-*`
                // scale encodes everywhere else on the site.
                { duration: 0.26, ease: [0.4, 0, 0.16, 1] }
          }
        >
          {message}
        </m.p>
      )}
    </AnimatePresence>
  )
}
