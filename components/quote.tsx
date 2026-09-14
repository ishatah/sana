import { getLocale } from "next-intl/server"
import { Reveal } from "@/components/motion/reveal"
import { localize, isEmpty, type LocalizedString } from "@/lib/localize"

/**
 * The template's full-bleed pull quote (`#section-my-quote`).
 *
 * Guarded twice: the page only renders it when getSectionAvailability() says the
 * quote exists, and it returns null again here if the text is empty. The second
 * check is not redundant — this is the one section where a failure renders an
 * attribution line under nothing, which reads as a quote the client never gave.
 * A section that fabricates a statement attributed to a named person is worth two
 * guards.
 */
export async function Quote({ text, attribution }: { text: LocalizedString; attribution?: string }) {
  if (isEmpty(text)) return null
  const locale = await getLocale()

  /*
   * `section-pad` rather than the `py-24` this carried: 96px was a hardcoded guess
   * that no longer matched the bands either side of it once the shared rhythm was
   * retuned, and a divider band out of step with its neighbours is exactly the
   * kind of misalignment that reads as sloppiness without the viewer being able to
   * name why.
   */
  return (
    <section className="section-pad relative overflow-hidden bg-[color:var(--surface)]/50">
      <div className="gradient-edge-top" />
      <div className="container-page relative z-10">
        <Reveal>
          <blockquote className="mx-auto max-w-3xl text-center">
            <p className="font-display text-xl leading-relaxed text-[color:var(--heading)] sm:text-2xl">
              {localize(text, locale)}
            </p>
            {attribution && (
              <footer className="mt-6 font-display text-[0.7rem] uppercase tracking-[0.25em] text-[color:var(--primary-strong)]">
                {attribution}
              </footer>
            )}
          </blockquote>
        </Reveal>
      </div>
      <div className="gradient-edge-bottom" />
    </section>
  )
}
