import { ProfileImage } from "@/components/profile-image"
import type { ResolvedMedia } from "@/lib/media"

/**
 * An image slot with a designed empty state.
 *
 * EVERY MEDIA SLOT ON THIS SITE IS EMPTY TODAY. lib/media.ts withholds an image
 * until it has a file, a recorded permission, a publishable tier AND alt text,
 * and intake section 14 lists every asset as not received, so `getMedia` returns
 * null for all six slots, and `ProfileImage` correspondingly renders nothing.
 *
 * That is the correct data behaviour and a bad layout outcome: a design built
 * around a figure beside a column collapses to a lone text block, and the section
 * reads as unfinished rather than as deliberate. The previous build worked around
 * this by having almost no figures at all.
 *
 * So an empty slot renders a FRAME rather than nothing. The frame holds the
 * section's decorative object, occupies the exact space the photograph will
 * occupy, and is explicitly not a picture of anything: no grey rectangle, no
 * camera glyph, no "image coming soon" caption that would read as a promise about
 * content nobody has approved. When a real photograph is uploaded and its
 * permission recorded, it drops into the same box and no layout changes.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: fabricate. It never renders a stock image,
 * never invents alt text, and never presents the placeholder as a depiction of a
 * person or place. The publish gate in lib/verification.ts governs copy; the same
 * restraint applies to imagery.
 */
export function SectionFigure({
  media,
  children,
  ratio = "4 / 5",
  className = "",
  ruled = true,
  width,
  height,
  sizes,
  priority = false,
  objectPosition,
}: {
  /** Already gated by lib/media.ts. Null until a slot has a file, a permission and alt text. */
  media: ResolvedMedia | null
  /** The decorative object shown while the slot is empty. Never rendered over a real image. */
  children?: React.ReactNode
  /** Aspect ratio of the frame, as a CSS `aspect-ratio` value. */
  ratio?: string
  className?: string
  /**
   * The `.card-ruled` accent bar. MUST be false for a round frame: the bar is
   * absolutely positioned at the inset-block/inline start, the corner of the
   * BOUNDING BOX, so on a circle it floats in the empty area outside the visible
   * shape, looking like a stray mark rather than a rule.
   */
  ruled?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
  /**
   * CSS `object-position` for the cropped image. Defaults to the centre, which is
   * what `object-cover` does anyway.
   *
   * IT EXISTS BECAUSE A SQUARE CROP OF A PORTRAIT IS ALMOST NEVER CENTRED. The
   * supplied portrait is 1206x1748 with the face in the top third; cropped to the
   * hero's 1:1 circle on the default centre, the frame lands on the subject's
   * hands and the head is cut off above the top edge. That is not a tuning
   * preference, it is the difference between a portrait and an unusable one.
   *
   * A prop rather than a hardcoded value here, because the right focal point is a
   * property of the individual photograph and the shape it is being cropped into,
   * both of which only the call site knows.
   */
  objectPosition?: string
}) {
  // A real photograph replaces the frame's decoration rather than sitting inside
  // it. The accent rule and the drifting object are the empty state's own design;
  // left behind a portrait they would read as decoration applied to someone's face.
  //
  // `overflow-hidden` and the caller's className are applied to BOTH branches.
  // They were on the empty branch only, which meant a round frame (`rounded-full`
  // via className) clipped the placeholder correctly and then failed to clip the
  // actual photograph, the bug would only have appeared on the day a real
  // portrait was finally approved, which is the worst possible time to find it.
  if (media) {
    /* The frame uncovers from its reading edge as it enters the viewport.
       It is the image FRAME that is clipped rather than the <img>, so the
       object-cover crop and object-position below are unaffected, the clip
       only decides how much of the finished frame is showing. */
    return (
      <div
        className={`figure-uncover relative w-full overflow-hidden ${className}`}
        style={{ aspectRatio: ratio }}
      >
        <ProfileImage
          media={media}
          // `fill` UNLESS the caller asked for intrinsic dimensions.
          //
          // The frame is an aspect-ratio box and the image is meant to cover it, so
          // the layout mode has to be fill. Without this, a caller that passes no
          // width/height, which is all of them, fell through to the record's own
          // intrinsic size (1206x1748 for the portrait), and next/image emitted
          // width and height attributes that the `h-full w-full object-cover`
          // classes then had to fight. The crop worked by accident of specificity
          // rather than by construction, and `object-position` had nothing stable
          // to act on.
          fill={!width || !height}
          width={width}
          height={height}
          sizes={sizes}
          priority={priority}
          className="h-full w-full object-cover"
          style={objectPosition ? { objectPosition } : undefined}
        />
      </div>
    )
  }

  return (
    <div
      // aria-hidden, and correctly so: there is no content here. A screen reader
      // announcing an empty decorative frame would be describing the absence of a
      // photograph, which is noise rather than information.
      aria-hidden
      className={`relative w-full overflow-hidden border border-[color:var(--border)] bg-[color:var(--surface)] ${
        ruled ? "card-ruled" : ""
      } ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {children}
    </div>
  )
}
