import {
  type ColorScheme,
  DEFAULT_THEME_FAMILY,
  THEME_FAMILIES,
  THEME_FAMILY_IDS,
  type ThemeFamily,
  themeName,
} from "./themeFamilies"

export const THEME_KEY = "eris.theme"

export const THEME_FAMILY_KEY = "eris.themeFamily"

export const THEME_PREFERENCES = ["system", "dark", "light"] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]

type ThemeStorage = Pick<Storage, "getItem" | "setItem">

export const loadThemePreference = (storage: ThemeStorage): ThemePreference => {
  const stored = storage.getItem(THEME_KEY)

  return THEME_PREFERENCES.find(preference => preference === stored) ?? "system"
}

export const saveThemePreference = (
  storage: ThemeStorage,
  preference: ThemePreference,
) => storage.setItem(THEME_KEY, preference)

export const loadThemeFamily = (storage: ThemeStorage): ThemeFamily => {
  const stored = storage.getItem(THEME_FAMILY_KEY)

  return (
    THEME_FAMILY_IDS.find(family => family === stored) ?? DEFAULT_THEME_FAMILY
  )
}

export const saveThemeFamily = (storage: ThemeStorage, family: ThemeFamily) =>
  storage.setItem(THEME_FAMILY_KEY, family)

export const resolveColorScheme = (
  preference: ThemePreference,
  systemDark: boolean,
): ColorScheme => {
  if (preference !== "system") {
    return preference
  }

  return systemDark ? "dark" : "light"
}

export const resolveTheme = (family: ThemeFamily, scheme: ColorScheme) => ({
  name: themeName(family, scheme),
  themeColor: THEME_FAMILIES[family][scheme]["base-100"],
})
