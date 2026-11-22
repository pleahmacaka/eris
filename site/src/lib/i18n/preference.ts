import { LOCALE_KEY, type LocaleTag } from "./locales"

export const rememberLocale = (tag: LocaleTag) => {
  try {
    localStorage.setItem(LOCALE_KEY, tag)
  } catch {
    return
  }
}
