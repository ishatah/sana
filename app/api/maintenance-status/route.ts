import { NextResponse } from "next/server"
import { getSiteSettings } from "@/lib/site-settings"

export const runtime = "nodejs"

/** Public, unauthenticated, and intentionally minimal: a boolean and nothing else.
 *  It exists so the client can poll during a maintenance window without exposing
 *  any part of the settings object. */
export async function GET() {
  try {
    const settings = await getSiteSettings()
    return NextResponse.json({ enabled: settings.maintenance?.enabled === true })
  } catch {
    // Fail open. A settings read failure must not present the site as down.
    return NextResponse.json({ enabled: false })
  }
}
