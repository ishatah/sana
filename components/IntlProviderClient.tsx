"use client"

import { NextIntlClientProvider } from "next-intl"
import { TIME_ZONE } from "@/i18n/routing"

/**
 * Re-establishes the intl context inside the client tree.
 *
 * TIME_ZONE is passed explicitly and must be. `i18n/request.ts` configures the
 * SERVER only, every NextIntlClientProvider builds its own config from scratch,
 * and one without a timeZone falls back to the runtime's own zone: the server's
 * during SSR, the visitor's in the browser. A date then formats differently in the
 * two passes and React reports a hydration mismatch.
 *
 * WHY LOCALE AND MESSAGES ARE PROPS RATHER THAN useLocale()/useMessages().
 *
 * This sits in the ROOT layout, which wraps /admin as well as /[locale]. The admin
 * panel is deliberately not localised, it is an internal tool with one user, and
 * routing it through the locale matcher would create /tr/admin, /en/admin and
 * /ar/admin, each needing its own auth check. But that means an /admin route has
 * no locale segment and therefore no request config, so `useMessages()` throws
 * during prerender and takes the whole build down with an opaque digest.
 *
 * Reading them on the server and passing them in fixes that at the source: the
 * server layout resolves what it can and hands down a safe default otherwise, so
 * the admin tree gets a working provider rather than a thrown hook.
 */
export function IntlProviderClient({
  locale,
  messages,
  children,
}: {
  locale: string
  messages: Record<string, unknown>
  children: React.ReactNode
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={TIME_ZONE}>
      {children}
    </NextIntlClientProvider>
  )
}
