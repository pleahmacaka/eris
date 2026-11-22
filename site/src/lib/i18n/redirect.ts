import { DEFAULT_LOCALE, LOCALE_KEY, LOCALES } from "./locales"
import { negotiateLocale } from "./negotiate"

const redirect = (
  negotiate: typeof negotiateLocale,
  supported: string[],
  fallback: string,
  key: string,
) => {
  let stored: string | null

  try {
    stored = localStorage.getItem(key)
  } catch {
    stored = null
  }

  const requested = stored
    ? [stored, ...navigator.languages]
    : navigator.languages
  const tag = negotiate(requested, supported, fallback)

  location.replace(`${tag}/${location.search}${location.hash}`)
}

const tags = LOCALES.map(locale => locale.tag)

export const redirectScript = `(${redirect})(${negotiateLocale},${JSON.stringify(tags)},${JSON.stringify(DEFAULT_LOCALE)},${JSON.stringify(LOCALE_KEY)})`
