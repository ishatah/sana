"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { INTERACTIONS } from "@/components/motion/interactions"

type Errors = Partial<Record<"name" | "email" | "message", string>>

/**
 * The contact form. Posts to /api/contact.
 *
 * The template ships a PHP mailer plus reCAPTCHA with the site key left as
 * "copy-your-site-key-here", which renders a broken widget on a live page. Neither
 * is carried over: the endpoint is a Route Handler, and spam is handled by the
 * honeypot below plus rate limiting server-side.
 *
 * Validation runs on both sides. This pass exists for the visitor — instant, in
 * their language, no round trip — and the API re-validates independently, because
 * a client-side check is a convenience and never a control.
 */
export function ContactForm() {
  const t = useTranslations("contact.form")
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [errors, setErrors] = useState<Errors>({})
  const formRef = useRef<HTMLFormElement>(null)

  /**
   * Field focus states and animated validation.
   *
   * Called directly rather than through `AnimeScope` for the same reason the nav
   * is: this is already a client component, and the contact page's section scope
   * is carrying `copyEmail` — a scope takes one interaction, and the form is the
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
    const form = new FormData(e.currentTarget)

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
      setState("sent")
      toast.success(t("success"))
      e.currentTarget.reset()
      setState("idle")
    } catch {
      setState("idle")
      toast.error(t("error"))
    }
  }

  const field = (name: keyof Errors) =>
    errors[name] ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {}

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      {/*
        Honeypot. Hidden from sight and from the accessibility tree, and skipped in
        the tab order, so no human fills it in — a submission that carries a value
        here is discarded server-side. `hidden` rather than an off-screen position:
        some bots read computed styles, and this costs nothing either way.
      */}
      <input type="text" name="company_website" tabIndex={-1} autoComplete="off" aria-hidden hidden />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="sr-only">
            {t("name")}
          </label>
          <input id="name" name="name" className="field-input" placeholder={t("name")} {...field("name")} />
          {errors.name && (
            <p id="name-error" className="mt-1.5 text-xs text-[color:var(--danger)]">
              {errors.name}
            </p>
          )}
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
          {errors.email && (
            <p id="email-error" className="mt-1.5 text-xs text-[color:var(--danger)]">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div data-interact="field">
        <label htmlFor="organisation" className="sr-only">
          {t("organisation")}
        </label>
        <input id="organisation" name="organisation" className="field-input" placeholder={t("organisation")} />
        <span aria-hidden className="field-underline" data-interact="field-underline" />
      </div>

      {/*
        The subject field exists so the enquiry cards on /contact have something to
        prefill — clicking "Investors" writes it here and focuses it.

        It was previously absent even though messages carried a `subject` label and
        the API already accepts the field, so the enquiry interaction had no target
        and the visitor had no way to say what they were writing about.
      */}
      <div data-interact="field">
        <label htmlFor="subject" className="sr-only">
          {t("subject")}
        </label>
        <input id="subject" name="subject" className="field-input" placeholder={t("subject")} />
        <span aria-hidden className="field-underline" data-interact="field-underline" />
      </div>

      <div>
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
        {errors.message && (
          <p id="message-error" className="mt-1.5 text-xs text-[color:var(--danger)]">
            {errors.message}
          </p>
        )}
      </div>

      <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">{t("consent")}</p>

      <button type="submit" disabled={state === "sending"} className="btn-main disabled:opacity-60">
        {/*
          A CSS RING REPLACES THE <Loader2> SPINNER, and the <Send> arrow is gone
          entirely — both were SVG.

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
        {state === "sending" ? t("sending") : t("send")}
      </button>
    </form>
  )
}
