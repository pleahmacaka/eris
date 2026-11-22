import { logoArt } from "#lib/brand/ascii.js"
import { LOCALES, localeInfo } from "#lib/i18n/locales.js"
import { buildCopy } from "#lib/server/copy.js"
import { copyText, fontHead } from "#lib/server/fonts.js"
import { loadCatalog } from "#lib/server/i18n/catalogs.js"
import { buildSeo } from "#lib/server/seo.js"
import type { EntryGenerator, PageServerLoad } from "./$types"

export const entries: EntryGenerator = () =>
  LOCALES.map(locale => ({ locale: locale.tag }))

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const locale = localeInfo(params.locale)
  const copy = buildCopy(locale.tag, await loadCatalog(locale.tag))

  const firstScreen = [
    locale.name,
    ...Object.values(copy.hero),
    copy.web.name,
    ...copy.installers.map(platform => platform.name),
    ...new Set(logoArt.layers.flatMap(layer => layer.rows).join("")),
  ].join("")

  locals.fontHead = fontHead(
    locale.tag,
    firstScreen,
    firstScreen + copyText(copy),
  )

  return { locale, copy, seo: buildSeo(url.origin, locale.tag) }
}
