import { NextRequest, NextResponse } from "next/server"
import { signToken } from "@/lib/auth"
import { safeEqual } from "@/lib/utils"

export const runtime = "nodejs"

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 8
const attempts = new Map<string, { count: number; resetAt: number }>()

/**
 * Admin login.
 *
 * Credentials come from env, never from the repo. The rate limit is per IP and
 * deliberately tight: this guards an editor for an unpublished profile containing
 * two unlisted phone numbers and two unconfirmed addresses, and there is exactly
 * one legitimate user, so eight tries per quarter hour is generous.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const now = Date.now()
  const entry = attempts.get(ip)

  if (entry && now < entry.resetAt && entry.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  const { username, password } = await req.json().catch(() => ({}) as any)

  const expectedUser = process.env.ADMIN_USERNAME
  const expectedPass = process.env.ADMIN_PASSWORD
  if (!expectedUser || !expectedPass || !process.env.ADMIN_SESSION_SECRET) {
    console.error("[admin login] Set ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_SESSION_SECRET.")
    return NextResponse.json({ error: "Admin is not configured" }, { status: 503 })
  }

  const ok =
    typeof username === "string" &&
    typeof password === "string" &&
    safeEqual(username, expectedUser) &&
    safeEqual(password, expectedPass)

  if (!ok) {
    // Count only failures, so a working session never walks toward a lockout.
    if (!entry || now > entry.resetAt) attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    else entry.count += 1
    // One message for both a wrong username and a wrong password: distinguishing
    // them confirms which usernames exist.
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  attempts.delete(ip)

  const token = await signToken()
  const res = NextResponse.json({ success: true })
  res.cookies.set("admin-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" rather than "strict": strict drops the cookie on any cross-site
    // navigation into /admin, which breaks following a link from email. Lax still
    // withholds it on cross-site POSTs, which is the CSRF case that matters.
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  })
  return res
}
