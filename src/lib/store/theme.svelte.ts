import { getCurrentWindow } from "@tauri-apps/api/window"
import { isDesktopApp } from "#lib/shell/platform.js"
import {
  loadThemeFamily,
  loadThemePreference,
  resolveColorScheme,
  resolveTheme,
  saveThemeFamily,
  saveThemePreference,
  type ThemePreference,
} from "#lib/shell/theme.js"
import {
  type ColorScheme,
  DEFAULT_THEME_FAMILY,
  THEME_FAMILIES,
  type ThemeFamily,
} from "#lib/shell/themeFamilies.js"

const SYSTEM_DARK = "(prefers-color-scheme: dark)"

class ThemeStore {
  preference = $state<ThemePreference>("system")
  family = $state<ThemeFamily>(DEFAULT_THEME_FAMILY)
  previewed = $state<ThemeFamily | null>(null)
  scheme = $state<ColorScheme>("dark")

  get shown() {
    return this.previewed ?? this.family
  }

  get palette() {
    return THEME_FAMILIES[this.family][this.scheme]
  }

  start() {
    const system = matchMedia(SYSTEM_DARK)

    this.preference = loadThemePreference(localStorage)
    this.family = loadThemeFamily(localStorage)
    this.#apply(system.matches)
    this.#syncWindow()
    system.addEventListener("change", () => this.#apply(system.matches))
  }

  set(preference: ThemePreference) {
    this.preference = preference
    saveThemePreference(localStorage, preference)
    this.#apply(matchMedia(SYSTEM_DARK).matches)
    this.#syncWindow()
  }

  setFamily(family: ThemeFamily) {
    this.family = family
    saveThemeFamily(localStorage, family)
    this.#apply(matchMedia(SYSTEM_DARK).matches)
  }

  preview(family: ThemeFamily | null) {
    this.previewed = family
    this.#apply(matchMedia(SYSTEM_DARK).matches)
  }

  #apply(systemDark: boolean) {
    const scheme = resolveColorScheme(this.preference, systemDark)
    const theme = resolveTheme(this.shown, scheme)
    const root = document.documentElement

    this.scheme = scheme
    root.dataset.theme = theme.name
    root.style.colorScheme = scheme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme.themeColor)
  }

  #syncWindow() {
    if (isDesktopApp()) {
      void getCurrentWindow().setTheme(
        this.preference === "system" ? null : this.preference,
      )
    }
  }
}

export const themeStore = new ThemeStore()
