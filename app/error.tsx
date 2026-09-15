"use client"

import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest is the only handle on the server-side stack, which Next withholds
    // from the client in production. Without logging it here a production error is
    // untraceable from a user report.
    console.error("[error]", error.digest ?? error.message)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center px-5 text-center">
      <div>
        <p className="eyebrow mb-3">Error</p>
        <h1 className="section-heading mb-8">Something went wrong</h1>
        <button type="button" onClick={reset} className="btn-outline">
          Try again
        </button>
      </div>
    </div>
  )
}
