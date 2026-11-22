import { type LocalePreference, parseLocalePreference } from "./locales"

export const LOCALE_KEY = "eris.locale"

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">

export const loadLocalePreference = (storage: PreferenceStorage) =>
  parseLocalePreference(storage.getItem(LOCALE_KEY))

export const saveLocalePreference = (
  storage: PreferenceStorage,
  preference: LocalePreference,
) => storage.setItem(LOCALE_KEY, preference)
