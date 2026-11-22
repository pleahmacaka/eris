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
export type LocalePreference = LocaleTag | "system"

export const DEFAULT_LOCALE = "en" satisfies LocaleTag

const byTag = new Map<string, LocaleInfo>(LOCALES.map(info => [info.tag, info]))

export const isLocaleTag = (value: string): value is LocaleTag =>
  byTag.has(value)

export const localeInfo = (tag: LocaleTag) => byTag.get(tag) ?? LOCALES[0]

export const parseLocalePreference = (
  value: string | null,
): LocalePreference => (value && isLocaleTag(value) ? value : "system")

type Subtags = { language: string; script: string | undefined }

const subtags = (tag: string): Subtags | null => {
  try {
    const { language, script } = new Intl.Locale(tag).maximize()
    return { language, script }
  } catch {
    return null
  }
}

const supported = LOCALES.map(({ tag }) => ({ tag, ...subtags(tag) }))

const firstMatch = (
  requested: Subtags[],
  matches: (candidate: (typeof supported)[number], wanted: Subtags) => boolean,
) => {
  for (const wanted of requested) {
    const found = supported.find(candidate => matches(candidate, wanted))
    if (found) {
      return found.tag
    }
  }
  return null
}

export const negotiateLocale = (requested: readonly string[]): LocaleTag => {
  const parsed = requested
    .map(subtags)
    .filter((value): value is Subtags => value !== null)

  return (
    firstMatch(
      parsed,
      (candidate, wanted) =>
        candidate.language === wanted.language &&
        candidate.script === wanted.script,
    ) ??
    firstMatch(
      parsed,
      (candidate, wanted) => candidate.language === wanted.language,
    ) ??
    DEFAULT_LOCALE
  )
}
