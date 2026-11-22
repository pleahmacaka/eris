export const LOCALES = [
  { tag: "en", name: "English", dir: "ltr" },
  { tag: "de", name: "Deutsch", dir: "ltr" },
  { tag: "fr", name: "Français", dir: "ltr" },
  { tag: "ru", name: "Русский", dir: "ltr" },
  { tag: "fa", name: "فارسی", dir: "rtl" },
  { tag: "vi", name: "Tiếng Việt", dir: "ltr" },
  { tag: "sr-Cyrl", name: "Српски (ћирилица)", dir: "ltr" },
  { tag: "sr-Latn", name: "Srpski (latinica)", dir: "ltr" },
  { tag: "uk", name: "Українська", dir: "ltr" },
  { tag: "es", name: "Español", dir: "ltr" },
  { tag: "pt-BR", name: "Português (Brasil)", dir: "ltr" },
  { tag: "zh-Hans", name: "简体中文", dir: "ltr" },
  { tag: "ja", name: "日本語", dir: "ltr" },
  { tag: "ko", name: "한국어", dir: "ltr" },
  { tag: "nl", name: "Nederlands", dir: "ltr" },
  { tag: "cs", name: "Čeština", dir: "ltr" },
  { tag: "it", name: "Italiano", dir: "ltr" },
  { tag: "fi", name: "Suomi", dir: "ltr" },
] as const

export type LocaleInfo = (typeof LOCALES)[number]

export type LocaleTag = LocaleInfo["tag"]

export const DEFAULT_LOCALE = "en" satisfies LocaleTag

export const LOCALE_KEY = "eris.locale"

const byTag = new Map<string, LocaleInfo>(LOCALES.map(info => [info.tag, info]))

export const isLocaleTag = (value: string): value is LocaleTag =>
  byTag.has(value)

export const localeInfo = (tag: LocaleTag) => byTag.get(tag) ?? LOCALES[0]
