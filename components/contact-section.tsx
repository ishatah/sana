import { getLocale, getTranslations } from "next-intl/server"
import { ContactForm } from "@/components/contact-form"
import { localize, type LocalizedString } from "@/lib/localize"
import type { ContactEmail, ContactPhone, OfficeAddress } from "@/lib/site-settings"

/**
 * The contact block.
 *
 * What it shows is decided entirely by lib/site-settings.ts, which allowlists on
 * `visibility === "public"`. Today that resolves to two email addresses and
 * nothing else, both phone numbers and both office addresses are marked
 * to-confirm pending open question Q6, and the third email is internal.
 *
 * So this component has to degrade well when most of the block is missing, and it
 * does that by saying so: `emailOnlyNote` tells the visitor contact is by email
 * rather than leaving them to notice an absence. A contact section that silently
 * shows one column reads as unfinished; one that states its channel reads as
 * deliberate, and it is deliberate.
 *
 * The address column falls back to the country alone. No address has been supplied
 * for publication, and section 15 forbids publishing a home address outright,
 * "Netherlands" is the most precise location that is certainly safe to publish.
 * Intake section 6 leaves the city to be named later only if she wants it.
 */
export async function ContactSection({
  emails,
  phones,
  addresses,
  cityOnly,
  showForm,
}: {
  emails: ContactEmail[]
  phones: ContactPhone[]
  addresses: OfficeAddress[]
  cityOnly: LocalizedString
  showForm: boolean
}) {
  const locale = await getLocale()
  const t = await getTranslations("contact")

  const emailOnly = emails.length > 0 && phones.length === 0 && addresses.length === 0

  return (
    <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
      {/* No `Reveal` wrapper: `arcArrival` animates each [data-anime="row"] and
          the form directly, both guarded by `ensureVisible`. A wrapper here was a
          second visibility gate that failed inside the full-viewport scope and
          hid rows the recipe had already revealed, see about-section.tsx. */}
      <div>
        <div className="space-y-9">
          {emails.length > 0 && (
            <div data-anime="row">
              <h3 className="mb-3 flex items-center gap-2.5 font-display text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--primary-strong)]">
                {t("emailLabel")}
              </h3>
              <ul className="space-y-2">
                {emails.map((e) => (
                  <li key={e.id} className="flex items-center gap-1">
                    {/*
                      The mailto link is untouched, the copy button is an ADDITION
                      beside it, not a replacement. Someone with a mail client
                      configured still gets one click to compose; someone without
                      one gets the address on their clipboard instead of a dead link.
                    */}
                    <a
                      id={`email-${e.id}`}
                      href={`mailto:${e.address}`}
                      className="text-sm text-[color:var(--card-foreground)] transition-colors hover:text-[color:var(--primary-strong)]"
                    >
                      {e.address}
                    </a>

                    <button
                      type="button"
                      className="copy-button"
                      data-interact="copy"
                      data-copy-value={e.address}
                      data-copy-target={`email-${e.id}`}
                      data-copied-label={t("copied")}
                      aria-label={`${t("copyAddress")}: ${e.address}`}
                    >
                      {/*
                        CSS-DRAWN MARKS, replacing the icon-library <Copy> and
                        <Check>, both rendered SVG.

                        Copy is two offset rounded squares, which is the same
                        "sheet behind a sheet" the glyph drew. Check is one box
                        with two borders, rotated 45deg: the classic tick built
                        from a corner, so it needs no path.

                        The wrappers keep `.copy-icon` and their `data-interact`
                        hooks untouched, so the JS that swaps idle for done is
                        unchanged, only what sits inside each layer differs.
                      */}
                      <span aria-hidden className="copy-icon" data-interact="copy-idle">
                        <span className="relative block h-[14px] w-[14px]">
                          <span className="absolute bottom-0 left-0 h-[10px] w-[10px] rounded-[2px] border border-current" />
                          <span className="absolute right-0 top-0 h-[10px] w-[10px] rounded-[2px] border border-current" />
                        </span>
                      </span>
                      <span aria-hidden className="copy-icon" data-interact="copy-done">
                        {/* Inline transform, not `-translate-y-[2px] rotate-45`:
                            composing those two through Tailwind's transform
                            variables resolved to `transform: none` on the nav's
                            close mark, leaving the shape unrotated. An explicit
                            declaration cannot be half-applied. */}
                        <span
                          className="block h-[12px] w-[7px] border-b-2 border-r-2 border-[color:var(--success)]"
                          style={{ transform: "translateY(-2px) rotate(45deg)" }}
                        />
                      </span>
                      {/*
                        The icon swap is aria-hidden, so without this a screen
                        reader gets no confirmation that anything happened, the
                        button would simply appear inert. `aria-live` announces
                        the result the moment the interaction writes it.
                      */}
                      <span className="sr-only" role="status" aria-live="polite" data-interact="copy-live" />
                    </button>

                    {e.label && localize(e.label, locale) && (
                      <span className="ms-1 text-xs text-[color:var(--muted-foreground)]">
                        {localize(e.label, locale)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {phones.length > 0 && (
            <div data-anime="row">
              <h3 className="mb-3 flex items-center gap-2.5 font-display text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--primary-strong)]">
                {t("phoneLabel")}
              </h3>
              <ul className="space-y-2">
                {phones.map((p) => (
                  <li key={p.id}>
                    {/* `dir="ltr"` is required even in the Arabic layout: a phone
                        number is an LTR run, and a leading "+" in an RTL paragraph
                        is otherwise rendered at the wrong end of the number. */}
                    <a
                      href={`tel:${p.number.replace(/\s/g, "")}`}
                      dir="ltr"
                      className="text-sm text-[color:var(--card-foreground)] transition-colors hover:text-[color:var(--primary-strong)]"
                    >
                      {p.number}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div data-anime="row">
            <h3 className="mb-3 flex items-center gap-2.5 font-display text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--primary-strong)]">
              {addresses.length > 0 ? t("addressLabel") : t("locationLabel")}
            </h3>
            {addresses.length > 0 ? (
              <ul className="space-y-2">
                {addresses.map((a) => (
                  <li key={a.id} className="text-sm leading-relaxed text-[color:var(--card-foreground)]">
                    {a.address}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[color:var(--card-foreground)]">{localize(cityOnly, locale)}</p>
            )}
          </div>

          {emailOnly && (
            <p className="border-s-2 border-[color:var(--primary)]/30 ps-4 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
              {t("emailOnlyNote")}
            </p>
          )}
        </div>
      </div>

      {showForm && (
        <div data-anime="form">
          <ContactForm />
        </div>
      )}
    </div>
  )
}
