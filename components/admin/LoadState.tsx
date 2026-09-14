"use client"

import Link from "next/link"
import { AlertTriangle } from "@/components/admin/icons"

/** Loading / failed-to-load state for an admin editor. Pass the error from useSection. */
export function LoadState({ error }: { error: string | null }) {
  if (!error) return <p className="text-sm text-[color:var(--muted-foreground)]">Loading…</p>

  const expired = error === "UNAUTHORIZED"

  return (
    <div className="max-w-md border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[color:var(--danger)]" aria-hidden />
        <div className="space-y-3">
          <p className="text-sm text-[color:var(--card-foreground)]">
            {expired ? "Your session has expired." : "This section couldn't be loaded."}
          </p>
          {expired ? (
            <Link href="/admin/login" className="btn-outline">
              Sign in again
            </Link>
          ) : (
            <>
              <p className="text-xs text-[color:var(--muted-foreground)]">{error}</p>
              <button type="button" onClick={() => window.location.reload()} className="btn-outline">
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
