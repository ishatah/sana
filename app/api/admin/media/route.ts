import { NextRequest } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { revalidatePath, revalidateTag } from "next/cache"
import { isAdminRequest } from "@/lib/auth"
import { supabase, isStorageConfigured } from "@/lib/supabase"

export const runtime = "nodejs"

const BUCKET = "cms-media"
const SECTION_FILE = "media.json"

/**
 * Media upload.
 *
 * This route exists to enforce one rule that a plain file upload cannot: A FILE MAY NOT
 * BE UPLOADED TO A SLOT THAT HAS NO RECORDED PERMISSION.
 *
 * The reasoning is the same as the 422 compliance gate on the copy route next door.
 * data/media.json can express "this asset is cleared", but a permission recorded only in
 * a JSON field is a note; a permission checked before the bytes are written is a rule.
 * Intake question Q5 asks for the portrait AND permission for the logos in one breath
 * precisely because the two arrive separately and it is the second that gets skipped —
 * someone has the file to hand, the slot is empty, and uploading is the obvious next
 * move. This refuses that move.
 *
 * The check reads the CURRENT stored section rather than trusting anything in the
 * request, so a client cannot assert its own permission alongside the file.
 */

// Rasters only.
//
// SVG USED TO BE ACCEPTED HERE, on the grounds that organisation logos are usually
// vector. It is no longer, because the app no longer renders any SVG at all and an
// upload allowlist is the one door that would let it back in — a slot filled with a
// vector logo would put drawn geometry back on a page the rest of this change took
// it off of.
//
// It also closes a real risk the old comment only mitigated. SVG is an ACTIVE format
// — it can carry script — and the mitigation was that it is served from Supabase
// Storage rather than `public/` and never inlined. That is sound but it is defence
// in depth around a format nothing needs; not accepting it is stronger than serving
// it carefully.
//
// A vector logo that genuinely has to go up should be rasterised to PNG at the size
// it will be used, which is what every other slot on this site already supplies.
const ALLOWED_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
])

const MAX_BYTES = 8 * 1024 * 1024

function localSectionPath() {
  return path.join(process.cwd(), "data", SECTION_FILE)
}

/** The stored media section — Storage first, repo file second, matching lib/cms-section.ts. */
async function readMediaSection(): Promise<any> {
  if (isStorageConfigured()) {
    try {
      const { data, error } = await supabase.storage.from("cms-content").download(SECTION_FILE)
      if (!error && data) return JSON.parse(await data.text())
    } catch {}
  }
  return JSON.parse(await fs.readFile(localSectionPath(), "utf-8"))
}

async function writeMediaSection(body: any): Promise<void> {
  const json = JSON.stringify(body, null, 2)
  if (isStorageConfigured()) {
    const blob = new Blob([json], { type: "application/json" })
    const { error } = await supabase.storage
      .from("cms-content")
      .upload(SECTION_FILE, blob, { upsert: true, contentType: "application/json" })
    if (error) throw new Error(error.message)
  }
  try {
    await fs.writeFile(localSectionPath(), json, "utf-8")
  } catch {}
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: "Expected a multipart form" }, { status: 400 })
  }

  const slotId = form.get("slotId")
  const file = form.get("file")

  if (typeof slotId !== "string" || !slotId.trim()) {
    return Response.json({ error: "Missing slotId" }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 })
  }

  const section = await readMediaSection()
  const slots = (section.slots ?? []) as any[]
  const index = slots.findIndex((s) => s.id === slotId)
  if (index === -1) {
    return Response.json({ error: `Unknown media slot "${slotId}"` }, { status: 404 })
  }

  /**
   * THE PERMISSION GATE. 422 rather than 400, for the same reason the copy route uses
   * it: the request is well-formed, the content is what is refused. The message names
   * what is missing so the answer is "go and get the permission" rather than "try a
   * different file".
   */
  const permission = slots[index].permission ?? {}
  if (permission.granted !== true) {
    return Response.json(
      {
        error: "This slot has no recorded permission, so no file can be uploaded to it.",
        reason:
          "Holding a file is not the same as having the right to publish it. Record who granted permission, when, and what the grant covers — then upload. Open question Q5 covers the portrait and the organisation logos.",
        slotId,
      },
      { status: 422 },
    )
  }

  const ext = ALLOWED_TYPES.get(file.type)
  if (!ext) {
    return Response.json(
      { error: `Unsupported file type "${file.type || "unknown"}". Allowed: JPEG, PNG, WebP, AVIF, SVG.` },
      { status: 415 },
    )
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    )
  }

  if (!isStorageConfigured()) {
    // No silent fallback to `public/`. The repo is the wrong home for client
    // photography: it is committed, it is pushed, and it is the one place an asset
    // cannot be withdrawn from later. Uploads require configured Storage.
    return Response.json(
      {
        error: "Media storage is not configured.",
        reason:
          "Set SUPABASE_URL and SUPABASE_SERVICE_KEY. Client photography is deliberately not written into the repository — a committed image cannot be withdrawn.",
      },
      { status: 503 },
    )
  }

  // Content-addressed enough to avoid collisions, readable enough to audit. The slot id
  // leads so the bucket lists by slot.
  const key = `${slotId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, { upsert: false, contentType: file.type })

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(key)

  slots[index] = {
    ...slots[index],
    path: publicUrl.publicUrl,
    uploadedAt: new Date().toISOString(),
  }

  try {
    await writeMediaSection({ ...section, slots })
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Uploaded, but the record could not be saved" }, { status: 500 })
  }

  revalidatePath("/", "layout")
  revalidateTag("cms-content", "minutes")

  return Response.json({ success: true, slotId, path: publicUrl.publicUrl })
}

/**
 * Detach a file from a slot.
 *
 * The stored object is deliberately NOT deleted. A withdrawn image is exactly the case
 * where someone later needs to establish what was published and when, and the record is
 * worth more than the few kilobytes. Clearing `path` is what stops it rendering, which
 * is the actual requirement.
 */
export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const slotId = new URL(request.url).searchParams.get("slotId")
  if (!slotId) return Response.json({ error: "Missing slotId" }, { status: 400 })

  const section = await readMediaSection()
  const slots = (section.slots ?? []) as any[]
  const index = slots.findIndex((s) => s.id === slotId)
  if (index === -1) return Response.json({ error: `Unknown media slot "${slotId}"` }, { status: 404 })

  slots[index] = { ...slots[index], path: "", detachedAt: new Date().toISOString() }

  try {
    await writeMediaSection({ ...section, slots })
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Failed to save" }, { status: 500 })
  }

  revalidatePath("/", "layout")
  revalidateTag("cms-content", "minutes")

  return Response.json({ success: true, slotId })
}
