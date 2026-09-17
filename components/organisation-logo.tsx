import Image from "next/image"
import type { ResolvedMedia } from "@/lib/media"

/**
 * A third party's logo, rendered from a gated media slot.
 *
 * WHY THIS EXISTS RATHER THAN REUSING AN IMAGE COMPONENT WE ALREADY HAVE.
 *
 * `SectionFigure` forces `object-fit: cover` onto an aspect-ratio box, which is
 * correct for a photograph (the frame is the composition and the crop is how you
 * choose it) and wrong for a logo, where cropping removes part of the mark. A
 * trimmed wordmark is not a smaller logo, it is a damaged one, and doing that to
 * somebody else's trademark is worse than doing it to our own.
 *
 * `ProfileImage` is closer and is the contract this copies, but it is shaped
 * around a portrait: it defaults to `fill`, and its credit line is written for
 * photographer attribution. This keeps the useful half (null in, null out; a
 * figure/figcaption when a credit is recorded) and drops the portrait assumptions.
 *
 * NULL IN, NULL OUT, AND THAT IS THE WHOLE SAFETY MODEL.
 *
 * `lib/media.ts` withholds a slot unless five things are true at once, and a
 * withheld slot arrives here as `null`. Returning null for null means every call
 * site can mount this unconditionally: while the slot is closed the markup simply
 * is not there, with no empty box, no reserved space and no layout shift. Nothing
 * at a call site needs a flag or a conditional, so nothing at a call site can
 * forget one.
 */
export function OrganisationLogo({
  media,
  className = "",
  sizes,
  priority = false,
  decorative = true,
}: {
  media: ResolvedMedia | null
  className?: string
  sizes?: string
  priority?: boolean
  /**
   * WHETHER THE MARK CARRIES MEANING A READER WOULD OTHERWISE MISS.
   *
   * Defaults to TRUE, which is the safer default and the commoner case. Every
   * placement so far sets the logo beside the organisation's name in visible
   * text, so the image restates what is already written. Giving it real alt text
   * there makes a screen reader announce the name twice in a row, which is a
   * WCAG failure (1.1.1's decorative-image rule) rather than extra helpfulness.
   *
   * Pass `decorative={false}` only where the mark appears WITHOUT the name next
   * to it. Then it is the only thing identifying the organisation, and the slot's
   * own localized alt text is what carries that.
   */
  decorative?: boolean
}) {
  if (!media) return null

  /*
   * INTRINSIC DIMENSIONS ARE REQUIRED, NOT OPTIONAL, AND THERE IS NO `fill` MODE.
   *
   * `fill` needs a positioned ancestor with a known size, which for a logo means
   * inventing an aspect ratio for someone else's artwork and letterboxing it
   * inside. With real width/height, `next/image` reserves exactly the right box
   * from the file's own proportions, so there is no CLS and no invented ratio.
   *
   * A slot with no dimensions recorded is therefore not renderable here. It is
   * treated as a withheld slot rather than guessed at, which matches how the rest
   * of the media layer handles an incomplete record.
   */
  if (!media.width || !media.height) return null

  const img = (
    <Image
      src={media.src}
      /* Empty string, not a missing prop: `alt=""` is the explicit signal that an
         image is decorative and should be skipped. Omitting alt entirely is a
         different thing, and assistive tech falls back to announcing the filename. */
      alt={decorative ? "" : media.alt}
      width={media.width}
      height={media.height}
      sizes={sizes}
      priority={priority}
      /* `object-contain` and an auto height: the mark scales inside whatever box
         the caller gives it and is never cropped. The caller sets the ceiling with
         a max-width; this guarantees the aspect ratio survives it. */
      className={`h-auto w-full object-contain ${className}`.trim()}
    />
  )

  /*
   * A recorded credit is rendered, and it is rendered as a FIGURE.
   *
   * Empty today. It exists because a third party's permission often comes with an
   * attribution condition attached, and the place to honour that is the same
   * place the image is rendered, not a paragraph somewhere else that can drift
   * away from it. `figure`/`figcaption` ties the two together in the
   * accessibility tree rather than leaving the credit as loose adjacent text.
   */
  if (media.credit) {
    return (
      <figure className="m-0">
        {img}
        <figcaption className="mt-2 text-[0.7rem] leading-relaxed text-[color:var(--muted-foreground)]">
          {media.credit}
        </figcaption>
      </figure>
    )
  }

  return img
}
