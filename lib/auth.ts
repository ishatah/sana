import { NextRequest } from "next/server"

/**
 * Admin session verification. HMAC-SHA256 over a base64 payload carrying an
 * expiry, verified with Web Crypto so this runs unchanged on the Edge runtime.
 *
 * The admin panel here edits an unpublished profile that contains, among other
 * things, two unlisted phone numbers and two unconfirmed addresses, so this is
 * guarding real personal data, not just page copy.
 */
async function verifyToken(token: string): Promise<boolean> {
  try {
    const [encodedPayload, encodedSig] = token.split(".")
    if (!encodedPayload || !encodedSig) return false

    const payload = atob(encodedPayload)
    const pairs = encodedSig.match(/.{2}/g)
    if (!pairs) return false
    const sigBytes = new Uint8Array(pairs.map((b) => parseInt(b, 16)))

    const { exp } = JSON.parse(payload) as { exp: number }
    if (!exp || Date.now() > exp) return false

    const secret = process.env.ADMIN_SESSION_SECRET
    if (!secret) return false
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    )

    return await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload))
  } catch {
    return false
  }
}

export async function signToken(ttlMs = 3600 * 1000): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET")
  const payload = JSON.stringify({ exp: Date.now() + ttlMs })
  const encodedPayload = btoa(payload)
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `${encodedPayload}.${hex}`
}

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("admin-session")?.value
  if (!token) return false
  return verifyToken(token)
}

export { verifyToken }
