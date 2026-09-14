import { NextRequest } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { revalidatePath, revalidateTag } from "next/cache"
import { isAdminRequest } from "@/lib/auth"
import { supabase, isStorageConfigured } from "@/lib/supabase"
import { findViolations } from "@/lib/verification"

export const runtime = "nodejs"

const BUCKET = "cms-content"

/**
 * The local data/*.json is the fallback for keys the stored CMS copy predates —
 * without this, a key newly added in code stays invisible until someone saves.
 */
function patchMissingFields(remote: any, local: any): any {
  if (Array.isArray(remote) && Array.isArray(local)) {
    return remote.map((item: any, i: number) => {
      if (local[i] === undefined) return item
      // A primitive has nothing to merge — keep the saved value. Returning local[i]
      // here would substitute the repo copy into every saved string array and the
      // next PUT would write that reverted list back. Silent destruction of the
      // owner's edits.
      if (typeof item !== "object" || item === null) return item
      return patchMissingFields(item, local[i])
    })
  }
  if (typeof remote !== "object" || remote === null) return remote
  const result: any = { ...remote }
  for (const [k, v] of Object.entries(local as object)) {
    if (result[k] === undefined) {
      result[k] = v
    } else if (v !== null && typeof v === "object" && result[k] !== null && typeof result[k] === "object") {
      result[k] = patchMissingFields(result[k], v)
    }
  }
  return result
}

// An allowlist, not a directory listing. A section missing from here 404s the GET,
// which an editor cannot recover from — so adding a data file means adding it here
// too. Enumerating the directory instead would turn any stray JSON into an
// editable, publishable section.
const ALLOWED_SECTIONS = [
  "identity",
  "headline",
  "positions",
  "expertise",
  "biography",
  "awards",
  "exclusions",
  "siteSettings",
  "navigation",
  "deliverables",
  "media",
]

// Sections whose copy can reach a visitor. A PUT to one of these is scanned for
// banned wording before it is written. `exclusions` and `deliverables` are absent
// deliberately: they are the internal record and necessarily name the excluded
// outfits, so scanning them would reject the log that prevents the violation.
const PUBLIC_SECTIONS = new Set([
  "identity",
  "headline",
  "positions",
  "expertise",
  "biography",
  "awards",
  "siteSettings",
  "navigation",
  // Alt text and credit lines are visitor-facing copy and reach the page like any
  // other string, so they are scanned for banned wording too. An image described as
  // "Dr. Sanae at the signing" is the same false claim as the sentence would be.
  "media",
])

function localPath(section: string) {
  return path.join(process.cwd(), "data", `${section}.json`)
}

async function readSection(section: string): Promise<any> {
  if (isStorageConfigured()) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(`${section}.json`)
      if (!error && data) {
        const remote = JSON.parse(await data.text())
        try {
          const local = JSON.parse(await fs.readFile(localPath(section), "utf-8"))
          return patchMissingFields(remote, local)
        } catch {
          return remote
        }
      }
    } catch {}
  }
  // Local file — dev, first boot, or no Storage project at all.
  return JSON.parse(await fs.readFile(localPath(section), "utf-8"))
}

async function writeSection(section: string, body: any): Promise<void> {
  const json = JSON.stringify(body, null, 2)

  if (isStorageConfigured()) {
    const blob = new Blob([json], { type: "application/json" })
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${section}.json`, blob, { upsert: true, contentType: "application/json" })
    if (error) throw new Error(error.message)
  }

  // Mirror to the repo file so the dev server and the build gate see the same copy.
  try {
    await fs.writeFile(localPath(section), json, "utf-8")
  } catch {}
}

/** Every string in a section, for the banned-wording scan. Keys prefixed with
 *  `_comment` are internal production notes and are skipped. */
function collectStrings(node: any, out: string[] = []): string[] {
  if (typeof node === "string") {
    out.push(node)
  } else if (Array.isArray(node)) {
    for (const v of node) collectStrings(v, out)
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("_comment")) continue
      collectStrings(v, out)
    }
  }
  return out
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { section } = await params
  if (!ALLOWED_SECTIONS.includes(section)) return Response.json({ error: "Not found" }, { status: 404 })
  try {
    return Response.json(await readSection(section))
  } catch (e: any) {
    console.error(`[content GET] Failed to read section "${section}":`, e?.message ?? e)
    return Response.json({ error: "Failed to read" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ section: string }> }) {
  if (!(await isAdminRequest(request))) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { section } = await params
  if (!ALLOWED_SECTIONS.includes(section)) return Response.json({ error: "Not found" }, { status: 404 })

  try {
    const body = await request.json()

    // A section is always a JSON object. Without this, a PUT of null, [] or a bare
    // string is accepted and upsert replaces the whole section with it — and the
    // revalidate below makes the damage live immediately.
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Expected a JSON object" }, { status: 400 })
    }
    if (Object.keys(body).length === 0) {
      return Response.json({ error: "Refusing to write an empty section" }, { status: 400 })
    }

    /**
     * THE COMPLIANCE GATE ON THE WRITE PATH.
     *
     * The build gate (scripts/check-publish-gate.mjs) catches banned wording in
     * CI, but /admin writes to Storage at runtime and goes live inside the
     * revalidate window without a build ever running. Without this check, the
     * whole verification-tier system is enforced everywhere except the one place
     * copy is actually edited.
     *
     * 422 rather than 400: the request is well-formed, the content is what is
     * refused. The response names the phrase and the reason so the editor can see
     * why — a rejection that just says "invalid" gets worked around.
     */
    if (PUBLIC_SECTIONS.has(section)) {
      const violations = collectStrings(body).flatMap((s) => findViolations(s))
      if (violations.length > 0) {
        return Response.json(
          {
            error: "This copy contains wording that cannot be published.",
            violations: violations.map((v) => ({ phrase: v.phrase, reason: v.reason })),
          },
          { status: 422 },
        )
      }
    }

    await writeSection(section, body)
    revalidatePath("/", "layout")
    // revalidatePath does not clear unstable_cache entries, and every reader of
    // this content goes through lib/cms-section.ts, cached under "cms-content"
    // with a 60s window. Without this the owner saves, reloads, sees the old copy,
    // and saves again.
    revalidateTag("cms-content", "minutes")
    return Response.json({ success: true, storage: isStorageConfigured() ? "remote" : "local-only" })
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Failed to write" }, { status: 500 })
  }
}
