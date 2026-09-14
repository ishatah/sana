import { unstable_cache } from "next/cache"
import { readFile } from "fs/promises"
import { join } from "path"
import { supabase } from "@/lib/supabase"

/**
 * Storage-first loader for a `data/*.json` CMS section.
 *
 * WHY THIS EXISTS. A section that does `import x from "@/data/x.json"` is baked at
 * build time. It can still have an admin editor, and that editor still writes to
 * Storage — so saving appears to work and changes nothing on the site. This is what
 * puts a section on the request-time path instead.
 *
 * Three layers of fallback, in order:
 *   1. the Storage copy      — what /admin writes, so this must win
 *   2. a runtime readFile    — the repo file, if Storage is unreachable
 *   3. the static import     — passed in as `local`, so a page can never render blank
 *
 * THE REMOTE IS LAYERED OVER THE LOCAL, NOT USED IN PLACE OF IT. A stored copy need
 * not contain every key the page destructures: an editor that only ever saved the
 * headline block leaves the rest absent, and the page has no way to know. Starting
 * from the repo file means a remote key can only ever *override*, never delete, so a
 * partial or truncated stored copy degrades to old copy instead of a 500.
 *
 * That matters more here than on an ordinary marketing site. Several fields in this
 * project are deliberately empty — `biography.quote`, every `stats[].value`, the
 * unanswered `startYear` on four positions — and the renderers treat empty as "hide
 * the section". A merge that resurrected a repo default over a cleared field would
 * put a fabricated number back on the page, which is the exact failure the intake
 * form's verification tiers exist to prevent. Empty values in the REMOTE therefore
 * survive the merge; only `undefined` (an absent key) falls back to local.
 *
 * Arrays are replaced wholesale rather than merged element-wise: the admin list
 * editors legitimately delete and reorder rows, and merging by index would
 * resurrect a deleted position or a deleted exclusion.
 */
function mergeOverLocal(local: any, remote: any): any {
  if (remote === undefined) return local
  // null is a real value in this dataset — `stats[].value: null` means "no figure
  // was supplied", which is not the same as "key missing". Preserve it.
  if (remote === null) return null
  if (Array.isArray(remote)) return remote
  if (typeof remote !== "object" || typeof local !== "object" || local === null || Array.isArray(local)) {
    return remote
  }
  const out: Record<string, any> = { ...local }
  for (const [k, v] of Object.entries(remote)) {
    out[k] = mergeOverLocal(local[k], v)
  }
  return out
}

export function cmsSection<T extends Record<string, any>>(name: string, local: T) {
  return unstable_cache(
    async (): Promise<T> => {
      try {
        const { data, error } = await supabase.storage.from("cms-content").download(`${name}.json`)
        if (!error && data) {
          const remote = JSON.parse(await data.text())
          if (remote && typeof remote === "object") return mergeOverLocal(local, remote) as T
        }
      } catch {
        // Storage unconfigured or unreachable. Fall through — the repo copy below
        // is a complete, valid section, so this is a degraded mode, not an outage.
      }
      try {
        const txt = await readFile(join(process.cwd(), "data", `${name}.json`), "utf-8")
        const parsed = JSON.parse(txt)
        if (parsed && typeof parsed === "object") return mergeOverLocal(local, parsed) as T
      } catch {}
      return local
    },
    [`cms-section-${name}`],
    { revalidate: 60, tags: ["cms-content", name] },
  )
}
