import { DEFAULT_LOCALE, LOCALES, type LocaleTag } from "./locales"

export const localeUrl = (origin: string, tag: LocaleTag, path = "") =>
  `${origin}/${tag}/${path}`

export const alternates = (origin: string, path = "") => [
  ...LOCALES.map(locale => ({
    hreflang: locale.tag as string,
    href: localeUrl(origin, locale.tag, path),
  })),
  {
    hreflang: "x-default",
    href: path === "" ? `${origin}/` : localeUrl(origin, DEFAULT_LOCALE, path),
  },
]
