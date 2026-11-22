import { LOCALES, localeInfo } from "#lib/i18n/locales.js"
import { DEMO_PATH } from "#lib/landing/content.js"
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
  const { mock, screens } = copy.showcase

  const firstScreen = copyText([
    copy.demo,
    screens.map(screen => screen.name),
    mock.nav,
    mock.channels,
    mock.threads.general,
    mock.placeholders.general,
    mock.members,
  ])

  locals.fontHead = fontHead(locale.tag, firstScreen, copyText(copy))

  return { locale, copy, seo: buildSeo(url.origin, locale.tag, DEMO_PATH) }
}
