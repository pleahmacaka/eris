import type { Handle } from "@sveltejs/kit/hooks"
import { THEME_FAMILIES } from "#lib/brand/themeFamilies.js"
import { DEFAULT_LOCALE, localeInfo } from "#lib/i18n/locales.js"
import { localeFont } from "#lib/server/fonts.js"

const THEME_COLOR = THEME_FAMILIES.eris.dark["base-100"]

export const handle: Handle = ({ event, resolve }) => {
  const locale = localeInfo(event.params.locale ?? DEFAULT_LOCALE)

  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html
        .replace("%lang%", locale.tag)
        .replace("%dir%", locale.dir)
        .replace("%font%", localeFont(locale.tag))
        .replace("%fonts%", event.locals.fontHead ?? "")
        .replace("%theme-color%", THEME_COLOR),
  })
}
