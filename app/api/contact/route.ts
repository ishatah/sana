import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Resend } from "resend"

export const runtime = "nodejs"

/**
 * Contact form endpoint.
 *
 * Replaces the template's contact.php + reCAPTCHA, which ships with the site key
 * left as a placeholder and therefore renders a broken widget on a live page.
 *
 * Spam is handled without a third-party widget:
 *   - a honeypot field no human ever fills,
 *   - a per-IP rate limit,
 *   - a length ceiling on every field.
 *
 * That is proportionate for a personal profile. A CAPTCHA is a real accessibility
 * and privacy cost, and this form's whole job is to let investors, organisers and
 * delegations through.
 */
const Body = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  organisation: z.string().trim().max(200).optional().default(""),
  subject: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().min(1).max(5000),
  // The honeypot. Present in the payload, expected to be empty.
  company_website: z.string().max(0).optional(),
})

/**
 * In-memory fixed-window limiter: 5 submissions per IP per 10 minutes.
 *
 * Deliberately in-process. It resets on deploy and does not span regions, which
 * is the correct trade for a single contact form on a personal site, a Redis
 * dependency here would be more moving parts than the thing it protects. Swap in
 * a shared store if this ever fronts something that matters more.
 */
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5
const hits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = hits.get(ip)

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    // Opportunistic sweep so the map cannot grow without bound across a long
    // uptime. Cheap because it only runs on a fresh window.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k)
    }
    return false
  }

  entry.count += 1
  return entry.count > MAX_PER_WINDOW
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"

  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 })
  }

  const { name, email, organisation, subject, message, company_website } = parsed.data

  // Honeypot tripped. Return 200, not 400: a bot that learns which submissions
  // were rejected learns how to avoid the trap. A human never reaches this branch.
  if (company_website) {
    return NextResponse.json({ success: true })
  }

  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.CONTACT_TO_EMAIL
  const from = process.env.CONTACT_FROM_EMAIL

  // Unconfigured mail is a 503, not a 500, and it is logged without the message
  // body. The submission belongs to the sender; it does not belong in a log
  // aggregator because an env var was missing.
  if (!apiKey || !to || !from) {
    console.error("[contact] Mail is not configured, set RESEND_API_KEY, CONTACT_TO_EMAIL and CONTACT_FROM_EMAIL.")
    return NextResponse.json({ error: "Mail is not configured" }, { status: 503 })
  }

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from,
      to,
      // `from` stays the verified sending domain, putting the visitor's address
      // there fails SPF/DKIM and lands the mail in spam. replyTo is what makes
      // hitting reply go to the visitor.
      replyTo: email,
      subject: subject ? `Contact: ${subject}` : `Contact form: ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        organisation ? `Organisation: ${organisation}` : null,
        "",
        message,
      ]
        .filter(Boolean)
        .join("\n"),
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[contact] Send failed:", e?.message ?? e)
    return NextResponse.json({ error: "Failed to send" }, { status: 502 })
  }
}
