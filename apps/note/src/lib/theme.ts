import type { Appearance, ThemeMode } from "./settings"

export const resolveMode = (mode: ThemeMode): "dark" | "light" => {
  if (mode !== "system") {
    return mode
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export const applyAppearance = (appearance: Appearance) => {
  const root = document.documentElement
  const mode = resolveMode(appearance.mode)

  root.dataset.theme = mode === "light" ? "arixlab-light" : "arixlab"
  root.dataset.mode = mode
  root.style.setProperty("--font-scale", String(appearance.fontScale))
}
