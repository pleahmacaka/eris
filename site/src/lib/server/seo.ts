import { alternates, localeUrl } from "#lib/i18n/alternates.js"
import type { LocaleTag } from "#lib/i18n/locales.js"

const OG_IMAGE = { path: "/og.png", width: "1200", height: "630" }

const openGraphLocale = (tag: LocaleTag) => {
  const { language, region } = new Intl.Locale(tag).maximize()

  return `${language}_${region}`
}

export const buildSeo = (origin: string, tag: LocaleTag) => ({
  canonical: localeUrl(origin, tag),
  alternates: alternates(origin),
  locale: openGraphLocale(tag),
  image: {
    url: `${origin}${OG_IMAGE.path}`,
    width: OG_IMAGE.width,
    height: OG_IMAGE.height,
  },
})

export type Seo = ReturnType<typeof buildSeo>
