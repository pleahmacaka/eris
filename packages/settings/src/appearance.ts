import { invoke } from "@tauri-apps/api/core"
import { SYSTEM_FONT, WINDOW_BACKGROUNDS, type WindowSurface } from "./defaults"
import type { Appearance, Background, ThemeMode } from "./model"

const DEFAULT_FONTS = `"Pretendard Variable", Pretendard, system-ui, sans-serif`

const fontStack = (font: string | undefined) => {
  const name = (font ?? "").replaceAll('"', "").trim()

  if (!name) {
    return null
  }

  return name === SYSTEM_FONT
    ? `system-ui, "Segoe UI Variable Text", "Segoe UI", sans-serif`
    : `"${name}", ${DEFAULT_FONTS}`
}

export const systemAccentHue = async () => {
  const hex = await invoke<string | null>("system_accent")

  return hex ? hueFromHex(hex) : null
}

const hueFromHex = (hex: string) => {
  const [red, green, blue] = [1, 3, 5].map(
    at => Number.parseInt(hex.slice(at, at + 2), 16) / 255,
  )
  const max = Math.max(red, green, blue)
  const span = max - Math.min(red, green, blue)

  if (span === 0) {
    return 0
  }

  const hue =
    max === red
      ? (green - blue) / span + (green < blue ? 6 : 0)
      : max === green
        ? (blue - red) / span + 2
        : (red - green) / span + 4

  return Math.round(hue * 60)
}

const darkScheme = () => window.matchMedia("(prefers-color-scheme: dark)")

export const resolveMode = (mode: ThemeMode): "dark" | "light" => {
  if (mode !== "system") {
    return mode
  }

  return darkScheme().matches ? "dark" : "light"
}

// One cache per module/window context, not per appearance application.
let nativeGlass: boolean | null = null

const syncNativeGlass = async (on: boolean, restingShadow: boolean) => {
  if (nativeGlass === on) {
    return
  }

  nativeGlass = on

  const { Effect, getCurrentWindow } = await import("@tauri-apps/api/window")
  const current = getCurrentWindow()

  if (on) {
    await current.setShadow(true)
    await current.setEffects({ effects: [Effect.Acrylic] })

    return
  }

  await current.clearEffects()
  await current.setShadow(restingShadow)
}

const isWindowSurface = (name: string | undefined): name is WindowSurface =>
  name !== undefined && Object.hasOwn(WINDOW_BACKGROUNDS, name)

const surfaceBackground = (a: Appearance, root: HTMLElement): Background => {
  const name = root.dataset.window
  const own =
    root.dataset.surface === "dock"
      ? a.dockBackground
      : isWindowSurface(name)
        ? a[WINDOW_BACKGROUNDS[name]]
        : "inherit"

  return own === "inherit" ? a.background : own
}

export const applyAppearance = async (
  a: Appearance,
  { restingShadow = false }: { restingShadow?: boolean } = {},
) => {
  const root = document.documentElement
  const dock = root.dataset.surface === "dock"
  const background = surfaceBackground(a, root)
  const systemHue = a.useSystemAccent
    ? await systemAccentHue().catch(() => null)
    : null
  const mode = resolveMode(a.mode)

  root.dataset.theme = mode === "light" ? "eris-light" : "eris"
  root.dataset.mode = mode
  root.dataset.background = background
  root.dataset.density = a.density
  root.dataset.motion = String(a.motion)
  root.dataset.dockBorder = String(a.dockBorder)

  const vars = {
    "--accent-hue": systemHue ?? a.accentHue,
    "--accent-spread": a.accentSpread,
    "--vividness": a.vividness,
    "--texture": a.texture,
    "--radius-scale": a.radius * (dock ? a.dockRadius : 1),
    "--blur-scale": a.blur * (dock ? a.dockBlur : 1),
    "--dock-tint": a.dockTint,
    "--font-scale": a.fontScale,
    "--surface-opacity": a.surfaceOpacity,
    "--dock-opacity": a.dockOpacity,
  }

  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, String(value))
  }

  const fonts = fontStack(a.font)

  for (const name of ["--font-sans", "--font-mono"]) {
    if (fonts) {
      root.style.setProperty(name, fonts)
    } else {
      root.style.removeProperty(name)
    }
  }

  if (root.dataset.surface === "window") {
    const glass = background === "glass"

    root.dataset.frame = glass || restingShadow ? "native" : "css"

    await syncNativeGlass(glass, restingShadow).catch(() => {
      nativeGlass = null
    })
  }
}
