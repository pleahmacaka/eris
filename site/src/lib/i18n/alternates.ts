import { LOCALES, type LocaleTag } from "./locales"

export const localeUrl = (origin: string, tag: LocaleTag) => `${origin}/${tag}/`

export const alternates = (origin: string) => [
  ...LOCALES.map(locale => ({
    hreflang: locale.tag as string,
    href: localeUrl(origin, locale.tag),
  })),
  { hreflang: "x-default", href: `${origin}/` },
]
