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
 * Today every slot resolves to null, intake section 14 lists every media asset as not
 * received, and open question Q5 covers both the portrait and permission for the logos,
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

  /*
   * DRAG IS DISABLED ON EVERY PHOTOGRAPH OF THE SUBJECT, ON HER INSTRUCTION.
   *
   * Two mechanisms, because neither is sufficient alone:
   *
   *   `draggable={false}` sets the HTML attribute, which is what Chrome and
   *   Firefox honour. It stops the drag GESTURE, so the image cannot be dragged
   *   to the desktop, into another tab, or into a message window.
   *
   *   `.no-drag` adds `-webkit-user-drag: none`, which is what Safari and other
   *   WebKit browsers need: WebKit will still paint a drag ghost and start a drag
   *   from an <img> that carries `draggable="false"`. The class also clears
   *   `user-select`, because a drag begun just outside the image can otherwise
   *   sweep it into a selection and drag it that way.
   *
   * WHAT THIS IS NOT. It is not image protection and must not be described as
   * such to the client: right-click Save Image, devtools, the network tab and a
   * screenshot all still work, and the file is served publicly by definition.
   * This removes the ACCIDENTAL drag — the one that happens when someone means to
   * scroll or select and instead peels the portrait off the page, which looks
   * broken. Anyone determined to copy the file still can, and no amount of
   * front-end code changes that.
   *
   * Applied here rather than at the call sites because this component is the only
   * thing on the site that renders a photograph, so doing it once covers every
   * present and future placement, and there is no call site that can forget.
   */
  const dragClass = `no-drag ${className}`.trim()

  const img = useFill ? (
    <Image
      src={media.src}
      alt={media.alt}
      fill
      sizes={sizes ?? "100vw"}
      priority={priority}
      draggable={false}
      className={dragClass}
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
      draggable={false}
      className={dragClass}
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
 * A decorative background image, the hero backdrop.
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
      {/* Not draggable, for the same reason as `ProfileImage` above: this slot is
          fed a photograph of the subject, and a decorative presentation does not
          make it a different file. */}
      <Image
        src={media.src}
        alt=""
        fill
        sizes="100vw"
        priority={priority}
        draggable={false}
        className="no-drag object-cover"
      />
    </div>
  )
}
