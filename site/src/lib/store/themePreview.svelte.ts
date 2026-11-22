import type { ColorScheme } from "#lib/brand/themeFamilies.js"
import { THEME_PREVIEW_KEY } from "#lib/brand/themePreview.js"

type ThemeChoice = Record<ColorScheme, string> & { id: string }

const SYSTEM_LIGHT = "(prefers-color-scheme: light)"

const THEME_COLOR = 'meta[name="theme-color"]'

const SURFACE = "--color-base-100"

const stored = () => {
  try {
    return sessionStorage.getItem(THEME_PREVIEW_KEY)
  } catch {
    return null
  }
}

const remember = (theme: string | null) => {
  try {
    if (theme === null) {
      sessionStorage.removeItem(THEME_PREVIEW_KEY)
    } else {
      sessionStorage.setItem(THEME_PREVIEW_KEY, theme)
    }
  } catch {
    return
  }
}

const apply = (theme: string) => {
  const root = document.documentElement

  root.dataset.theme = theme
  document
    .querySelector(THEME_COLOR)
    ?.setAttribute(
      "content",
      getComputedStyle(root).getPropertyValue(SURFACE).trim(),
    )
}

class ThemePreview {
  family = $state<string | null>(null)
  scheme = $state<ColorScheme>("dark")
  active = $state(false)
  #choice: ThemeChoice | null = null

  shows(family: string) {
    return this.active && this.family === family
  }

  restore(choices: ThemeChoice[], fallback: string) {
    const theme = stored()

    if (theme === null) {
      return
    }

    const dark = choices.find(choice => choice.dark === theme)
    const light = choices.find(choice => choice.light === theme)

    if (dark) {
      this.#show(dark, "dark")
    } else if (light) {
      this.#show(light, "light")
    } else {
      this.reset(fallback)
    }
  }

  toggle(choice: ThemeChoice, fallback: string) {
    if (this.shows(choice.id)) {
      this.reset(fallback)

      return
    }

    const system = matchMedia(SYSTEM_LIGHT).matches ? "light" : "dark"

    this.#show(choice, this.active ? this.scheme : system)
  }

  setScheme(scheme: ColorScheme) {
    if (this.#choice) {
      this.#show(this.#choice, scheme)
    }
  }

  reset(fallback: string) {
    this.active = false
    apply(fallback)
    remember(null)
  }

  #show(choice: ThemeChoice, scheme: ColorScheme) {
    this.#choice = choice
    this.family = choice.id
    this.scheme = scheme
    this.active = true
    apply(choice[scheme])
    remember(choice[scheme])
  }
}

export const themePreview = new ThemePreview()
