import Image from "next/image"
import type { ResolvedMedia } from "@/lib/media"

/**
 * The only component on this site that renders a photograph.
 *
 * IT RETURNS NULL WHEN HANDED NULL, and that is the entire design. `lib/media.ts`
 * resolves a slot to either a fully-cleared record or null, so every call site can
 * render this unconditionally:
 *
 *   <ProfileImage media={portrait} ... />
 *
 * rather than each one repeating a `permission.granted && path && alt` check that can be
 * written slightly differently in the fourth place someone adds an image. There is one
 * gate, it lives in lib/media.ts, and this component is the only thing downstream of it.
 *
 * Today every slot resolves to null — intake section 14 lists every media asset as not
 * received, and open question Q5 covers both the portrait and permission for the logos —
 * so this renders nothing anywhere on the site. That is the correct current state, not a
 * placeholder awaiting a stock photo.
 */
export function ProfileImage({
  media,
  className = "",
  sizes,
  priority = false,
  fill = false,
  width,
  height,
  style,
}: {
  media: ResolvedMedia | null
  className?: string
  sizes?: string
  priority?: boolean
  fill?: boolean
  width?: number
  height?: number
  /** Passed straight through. Its one caller today sets `objectPosition`, which
   *  has to be a style rather than a class because the focal point of a crop is a
   *  per-photograph value, not one of a fixed set. */
  style?: React.CSSProperties
}) {
  if (!media) return null

  // `fill` and explicit dimensions are mutually exclusive in next/image, and a resolved
  // record may carry its own intrinsic size from the upload. Prefer the caller's
  // dimensions, fall back to the stored ones, and only then to fill.
  const w = width ?? media.width
  const h = height ?? media.height
  const useFill = fill || !w || !h

  const img = useFill ? (
    <Image
      src={media.src}
      alt={media.alt}
      fill
      sizes={sizes ?? "100vw"}
      priority={priority}
      className={className}
      style={style}
    />
  ) : (
    <Image
      src={media.src}
      alt={media.alt}
      width={w}
      height={h}
      sizes={sizes}
      priority={priority}
      className={className}
      style={style}
    />
  )

  // A credit line is rendered as a figure so the attribution is associated with the
  // image in the accessibility tree rather than floating next to it as loose text.
  // Photographs supplied by a third party usually carry an attribution condition; this
  // is where it is honoured.
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

/**
 * A decorative background image — the hero backdrop.
 *
 * `alt=""` plus aria-hidden is correct HERE and nowhere else in this file: the hero
 * backdrop carries no information the heading does not already state, so announcing it
 * would be noise. The alt text on the record is still required by the gate in
 * lib/media.ts (it is what an editor writes to confirm they looked at the file), it is
 * simply not exposed to the accessibility tree in this one presentation.
 */
export function BackgroundImage({
  media,
  className = "",
  priority = true,
}: {
  media: ResolvedMedia | null
  className?: string
  priority?: boolean
}) {
  if (!media) return null

  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden ${className}`}>
      <Image src={media.src} alt="" fill sizes="100vw" priority={priority} className="object-cover" />
    </div>
  )
}
