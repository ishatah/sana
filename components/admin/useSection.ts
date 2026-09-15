"use client"

import { useEffect, useState } from "react"

/**
 * Loads a CMS section for an admin editor.
 *
 * The naive version is `fetch(...).then(r => r.json()).then(setData)` with no
 * res.ok check, and GET /api/admin/content/[section] returns truthy JSON on both
 * failure branches: {error:"Unauthorized"} 401 and {error:"Failed to read"} 500.
 * That object passes an `if (!data)` guard, reaches the render, and throws on the
 * first dereference, so an expired session shows a crash instead of a login prompt.
 */
export async function fetchSection<T = any>(section: string): Promise<T> {
  const r = await fetch(`/api/admin/content/${section}`)
  if (r.status === 401) throw new Error("UNAUTHORIZED")
  if (!r.ok) throw new Error(`Couldn't load this section (${r.status})`)
  return (await r.json()) as T
}

export function useSection<T = any>(section: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSection<T>(section)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        // A non-JSON body (an HTML error page) rejects inside r.json() and lands
        // here too, which is why the naive version can hang on "Loading…" forever.
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load this section")
      })
    return () => {
      cancelled = true
    }
  }, [section])

  return { data, setData, error }
}

/**
 * Saves a section, surfacing the compliance rejection as a readable error.
 *
 * The PUT returns 422 with a `violations` array when the copy contains banned
 * wording. Collapsing that into a generic "Save failed" would leave the editor
 * with no idea which phrase was refused or why, and the natural next move is to
 * retry the same text.
 */
export async function saveSection(section: string, data: unknown): Promise<void> {
  const res = await fetch(`/api/admin/content/${section}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })

  if (res.status === 422) {
    const body = await res.json().catch(() => ({}) as any)
    const detail = (body.violations ?? []).map((v: any) => `"${v.phrase}", ${v.reason}`).join("\n\n")
    throw new Error(detail || body.error || "This copy cannot be published.")
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as any)
    throw new Error(body.error ?? "Save failed")
  }
}
