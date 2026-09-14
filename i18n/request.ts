import { getRequestConfig } from "next-intl/server"
import { hasLocale } from "next-intl"
import { routing, TIME_ZONE } from "./routing"

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Server side only — every NextIntlClientProvider must pass TIME_ZONE too.
    timeZone: TIME_ZONE,
  }
})
