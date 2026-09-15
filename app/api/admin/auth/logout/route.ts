import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST() {
  const res = NextResponse.json({ success: true })
  // maxAge 0 with the same path the cookie was set on, a mismatched path leaves
  // the original cookie in place and the session survives a "log out".
  res.cookies.set("admin-session", "", { httpOnly: true, path: "/", maxAge: 0 })
  return res
}
