"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "@/components/admin/icons"

function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        // `from` is attacker-controllable, anyone can send an admin a
        // /admin/login?from=… link. Unchecked it is an open redirect, and a
        // `javascript:` value would run in this origin with a live session cookie.
        // Only a same-origin /admin path may be followed; note that "//evil.com"
        // and "https://evil.com" both fail this test.
        const requested = searchParams.get("from") || "/admin"
        const to = /^\/admin(?:[/?#]|$)/.test(requested) ? requested : "/admin"
        window.location.href = to
      } else {
        const body = await res.json().catch(() => ({}) as any)
        setError(body.error || "Invalid credentials.")
        setPassword("")
      }
    } catch {
      setError("Connection error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const input =
    "w-full bg-[color:var(--background)] border border-[color:var(--input)] text-[color:var(--card-foreground)] px-4 py-2.5 text-sm focus:border-[color:var(--primary)] focus:outline-none transition-colors"

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-9 text-center">
          <p className="eyebrow mb-2">Client CL-02-SR</p>
          <h1 className="font-display text-xl font-bold uppercase tracking-[0.15em] text-[color:var(--heading)]">
            Sanae Rakik
          </h1>
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">Profile administration</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="username" className="block text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)]">
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className={input}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={input}
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-[color:var(--danger)]">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-main w-full disabled:opacity-60">
            {loading && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary, without one this route opts the
  // whole segment into client-side rendering at build time.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
