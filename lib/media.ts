import { cmsSection } from "@/lib/cms-section"
import { localize, isEmpty, type LocalizedString } from "@/lib/localize"
import { isPublishable } from "@/lib/verification"
import mediaLocal from "@/data/media.json"

/**
 * The media allowlist.
 *
 * This is the image counterpart of `getPublicContact()` in lib/site-settings.ts, and it
 * is built the same way and for the same reason: the default is WITHHELD, so an asset
 * that arrives without an explicit decision stays invisible until someone makes one.
 *
 * The opposite default, render anything with a file path, hide only what is marked
 * private, publishes whatever anyone forgets to mark. On this file that failure has a
 * specific shape: intake section 14 lists every media asset as not received, and open
 * question Q5 asks for the portrait AND permission for the logos together, precisely
 * because holding a file and having the right to publish it are different things. An
 * organisation's mark on a personal profile without that organisation's agreement is
 * the kind of thing that damages the relationship the profile exists to represent.
 *
 * So `permission.granted` is a required, separate field rather than an inference from
 * the presence of a path.
 */

export const getMediaRaw = cmsSection("media", mediaLocal as any)

export type MediaKind = "portrait" | "background" | "logo" | "og"

export interface MediaPermission {
  granted?: boolean
  /** The rights holder who granted it, not always the client. Event photography is
   *  usually the photographer's copyright, so a grant from the subject alone may not
   *  be sufficient. */
  grantedBy?: string
  grantedOn?: string
  /** What the grant actually covers: "website only", "all deliverables", etc. */
  scope?: string
  /** Where the file and the grant came from, so an asset can be traced back. */
  source?: string
}

export interface MediaSlot {
  id: string
  kind: MediaKind | string
  /** Links a logo to a row in data/positions.json. */
  organisationId?: string
  path?: string
  alt?: LocalizedString
  credit?: string
  permission?: MediaPermission
  tier?: string
  publish?: boolean
  width?: number
  height?: number
}

/** A slot that has cleared every gate and carries usable alt text. */
export interface ResolvedMedia {
  id: string
  kind: string
  organisationId?: string
  src: string
  alt: string
  credit?: string
  width?: number
  height?: number
}

/**
 * The publish test, in one place.
 *
 * Four independent conditions, and none of them implies another:
 *
 *   1. a file exists, `path`
 *   2. someone recorded permission, `permission.granted`
 *   3. it has not been withheld, `publish !== false`
 *   4. the source is not tier C, via isPublishable(), the same rule the
 *                                         positions and awards lists run
 *
 * Condition 4 reuses lib/verification.ts rather than restating the tier logic. A
 * second copy of "tier C is never published" is a second place for it to drift, and the
 * whole point of that module is that the rule exists once.
 */
export function isRenderable(slot: MediaSlot): boolean {
  if (!slot.path || slot.path.trim() === "") return false
  if (slot.permission?.granted !== true) return false
  return isPublishable({ tier: slot.tier, publish: slot.publish })
}

/**
 * Resolve one slot for a locale, or null if it may not render.
 *
 * ALT TEXT IS PART OF THE GATE, not a nicety applied afterwards. A record with no alt
 * text in any locale resolves to null even when the permission block is complete,
 * because an image nobody has described is an image nobody has checked, and on a
 * profile whose credibility is the product, an undescribed photograph of a person is
 * exactly the asset that should not slip out.
 *
 * Returning null rather than an empty string means every call site can render
 * unconditionally: there is no `alt=""` path that quietly ships an unlabelled image.
 */
export function resolveMedia(slot: MediaSlot | undefined | null, locale: string): ResolvedMedia | null {
  if (!slot || !isRenderable(slot)) return null
  if (isEmpty(slot.alt)) return null

  return {
    id: slot.id,
    kind: slot.kind,
    organisationId: slot.organisationId,
    src: slot.path as string,
    alt: localize(slot.alt, locale),
    credit: slot.credit || undefined,
    width: slot.width,
    height: slot.height,
  }
}

async function slots(): Promise<MediaSlot[]> {
  const data = await getMediaRaw()
  return (data.slots ?? []) as MediaSlot[]
}

/** One slot by id, gated. Returns null when it may not render, which is every slot today. */
export async function getMedia(id: string, locale: string): Promise<ResolvedMedia | null> {
  const all = await slots()
  return resolveMedia(
    all.find((s) => s.id === id),
    locale,
  )
}

/**
 * The logo for one position row, gated.
 *
 * Note what this does NOT do: it takes no view on which organisations may have a mark.
 * Any per-row logo exclusion is enforced at the call site in
 * components/role-entry.tsx, in code, because that is a rule about a specific row
 * rather than about the data, and a rule that lives only in the absence of a data
 * entry is one an admin save can undo.
 */
export async function getOrganisationLogo(organisationId: string, locale: string): Promise<ResolvedMedia | null> {
  const all = await slots()
  return resolveMedia(
    all.find((s) => s.kind === "logo" && s.organisationId === organisationId),
    locale,
  )
}

/**
 * Slots that hold a file but have no recorded permission.
 *
 * This is the failure the whole module exists to prevent, so it is surfaced rather than
 * merely handled: scripts/check-publish-gate.mjs fails the build on a non-empty result,
 * and /admin/media lists them. A file sitting in storage that nobody cleared is not a
 * quiet no-op, it is an asset one careless edit away from being published.
 */
export async function getUnclearedMedia(): Promise<MediaSlot[]> {
  const all = await slots()
  return all.filter((s) => s.path && s.path.trim() !== "" && s.permission?.granted !== true)
}

/** Production status for /admin, what is present, what is cleared, what is still missing. */
export async function getMediaStatus() {
  const all = await slots()
  return all.map((s) => ({
    id: s.id,
    kind: s.kind,
    hasFile: Boolean(s.path && s.path.trim() !== ""),
    hasPermission: s.permission?.granted === true,
    hasAlt: !isEmpty(s.alt),
    renderable: isRenderable(s) && !isEmpty(s.alt),
  }))
}
