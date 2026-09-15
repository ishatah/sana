"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ExternalLink, LogOut, Menu, X, Timer } from "@/components/admin/icons"
import { SidebarNav, navGroups } from "@/components/admin/SidebarNav"
import { Toaster } from "@/components/toaster"

const IDLE_MS = 15 * 60 * 1000
const WARN_MS = 5 * 60 * 1000

/**
 * The admin shell: sidebar, header, idle timeout.
 *
 * The login page renders bare, it is inside this route group but must not show
 * the chrome of the thing you have not signed into yet.
 *
 * WHY THE IDLE TIMEOUT. This panel edits an unpublished profile holding two
 * unlisted phone numbers, two unconfirmed addresses, and the exclusions log
 * naming rejected title-selling outfits. A session left open on a laptop in a
 * shared office is the realistic exposure, not a remote attacker. Fifteen minutes
 * with a five-minute visible warning is the same shape ryzo uses.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [remaining, setRemaining] = useState(IDLE_MS)
  const lastActivity = useRef(Date.now())

  const isLogin = pathname === "/admin/login"

  const logout = useCallback(async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/admin/login")
  }, [router])

  useEffect(() => {
    if (isLogin) return

    const bump = () => {
      lastActivity.current = Date.now()
    }
    // `passive` on the scroll/touch listeners: these fire constantly and must
    // never block the main thread on a panel that is mostly forms.
    const events: (keyof WindowEventMap)[] = ["mousedown", "keydown", "scroll", "touchstart"]
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))

    const tick = setInterval(() => {
      const idle = Date.now() - lastActivity.current
      const left = IDLE_MS - idle
      setRemaining(left)
      if (left <= 0) logout()
    }, 1000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(tick)
    }
  }, [isLogin, logout])

  // Close the mobile drawer on navigation, otherwise it stays open over the page
  // that was just opened behind it.
  useEffect(() => setOpen(false), [pathname])

  if (isLogin) {
    return (
      <div className="min-h-screen bg-[color:var(--background)]">
        {children}
        <Toaster position="bottom-right" theme="dark" richColors />
      </div>
    )
  }

  const label = navGroups.flatMap((g) => g.items).find((i) => (i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href)))?.label

  const warning = remaining <= WARN_MS
  const mins = Math.max(0, Math.floor(remaining / 60000))
  const secs = Math.max(0, Math.floor((remaining % 60000) / 1000))

  return (
    <div className="min-h-screen bg-[color:var(--background)] lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-e border-[color:var(--border)] bg-[color:var(--surface)] p-5 lg:block">
        <div className="mb-8 px-3">
          <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--heading)]">
            Sanae Rakik
          </p>
          <p className="mt-0.5 text-[0.7rem] text-[color:var(--muted-foreground)]">CL-02-SR · Admin</p>
        </div>
        <SidebarNav />
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Menu"
              // 44x44 (WCAG 2.5.5). p-1 around a 20px icon is 28x28.
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-1 text-[color:var(--heading)] lg:hidden"
            >
              <Menu size={20} />
            </button>
            {label && <h1 className="font-display text-sm font-bold uppercase tracking-widest text-[color:var(--heading)]">{label}</h1>}
          </div>

          <div className="flex items-center gap-4">
            {warning && (
              <span
                role="status"
                className="hidden items-center gap-1.5 text-[0.7rem] tracking-widest text-[color:var(--warning)] sm:flex"
              >
                <Timer size={13} aria-hidden />
                {mins}:{String(secs).padStart(2, "0")}
              </span>
            )}
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--primary-strong)]"
            >
              View site
              <ExternalLink size={12} aria-hidden />
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--danger)]"
            >
              <LogOut size={12} aria-hidden />
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-[270px] overflow-y-auto bg-[color:var(--surface)] p-5">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-sm font-bold uppercase tracking-widest text-[color:var(--heading)]">Admin</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-1 text-[color:var(--heading)]"
              >
                <X size={18} />
              </button>
            </div>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            // Pure black at 60%, not the old #171717/50: a near-black scrim at
            // half opacity over a charcoal page is almost the page's own colour,
            // so the drawer had no visible backdrop to dismiss.
            className="flex-1 bg-black/60"
          />
        </div>
      )}

      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  )
}
