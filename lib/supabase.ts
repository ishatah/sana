import { createClient, SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | undefined

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variable")
    _client = createClient(url, key)
  }
  return _client
}

/**
 * Lazy proxy rather than a module-level client.
 *
 * Every content module imports this, and a bare `createClient()` at module scope
 * throws during `next build` on any machine without the env vars — which includes
 * a clean checkout and CI. Going through the proxy means the throw happens only if
 * something actually reaches for Storage, and lib/cms-section.ts catches it and
 * falls through to the repo copy. The site therefore builds and renders with no
 * Supabase project at all, which is the state this repo is in today.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop]
  },
})

/** True when Storage is configured. The admin UI reads this to explain that saves
 *  will be local-only rather than failing with an opaque error. */
export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
}
