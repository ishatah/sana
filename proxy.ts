import createMiddleware from "next-intl/middleware"
import { NextRequest, NextResponse } from "next/server"
import { routing } from "@/i18n/routing"

const intlMiddleware = createMiddleware(routing)

/** The header the root layout reads to set `lang` and `dir` on <html>. */
export const LOCALE_HEADER = "x-app-locale"

/**
 * Middleware. Three jobs, in this order.
 *
 * 1. GUARD /admin. An unauthenticated request is redirected to the login page with
 *    the requested path in `from`, so signing in lands where the person was going.
 *    The cookie's mere presence is enough here — the HMAC is verified properly in
 *    every API route via isAdminRequest. This is a routing decision, not the
 *    security boundary, and treating it as one would put the session secret on the
 *    edge for no gain.
 *
 * 2. LOCALE ROUTING for everything else.
 *
 * 3. PUBLISH THE RESOLVED LOCALE as a request header.
 *
 *    Point 3 exists for a specific reason. The root layout renders ABOVE the
 *    `[locale]` segment, so `setRequestLocale` has not run when it executes and
 *    `getLocale()` there resolves to the default for every locale — which rendered
 *    `<html lang="tr">` on /en and /ar. But <html> belongs to the root layout and
 *    cannot be moved into the segment, so the locale has to reach it some other
 *    way. A request header set here is that way: it is available synchronously via
 *    headers(), it is correct on the very first server render, and it needs no
 *    client-side correction, so a no-JS visitor and a crawler both get the right
 *    document language.
 *
 * /admin is deliberately NOT localised. It is an internal tool with one user, and
 * running it through the locale matcher would create /nl/admin, /ar/admin and
 * /ar/admin, each needing its own auth check and redirect target.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next()

    const session = request.cookies.get("admin-session")?.value
    if (!session) {
      const url = new URL("/admin/login", request.url)
      url.searchParams.set("from", pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // Derive the locale from the path BEFORE handing off, so the value does not
  // depend on parsing next-intl's internal rewrite headers back out. With
  // `localePrefix: "as-needed"` the default locale carries no prefix, so an
  // unprefixed path is the default rather than an error.
  const match = pathname.match(new RegExp(`^/(${routing.locales.join("|")})(?:/|$)`))
  const locale = match?.[1] ?? routing.defaultLocale

  // Attach the locale to the REQUEST headers, which is what headers() reads inside
  // a server component. Setting it on the response only would reach the browser
  // and never the render.
  request.headers.set(LOCALE_HEADER, locale)

  const response = intlMiddleware(request)
  response.headers.set(LOCALE_HEADER, locale)
  return response
}

export const config = {
  // Everything except Next internals, the API, and static files. `admin` is
  // matched (so the guard above runs) but never reaches the intl middleware.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
