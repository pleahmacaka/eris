import {
  type Appearance,
  defaultAppearance,
  systemAccentHue,
  type ThemeMode,
} from "./settings"

export type PresetDefinition = {
  id: string
  name: string
  description: string
  appearance: Appearance
  swatch: [string, string, string]
}

const preset = (
  id: string,
  name: string,
  description: string,
  swatch: [string, string, string],
  appearance: Partial<Appearance>,
): PresetDefinition => ({
  id,
  name,
  description,
  swatch,
  appearance: { ...defaultAppearance, ...appearance },
})

export const presets: PresetDefinition[] = [
  preset(
    "aurora",
    "Aurora",
    "Drifting orbs on deep blue",
    ["#1b1b26", "#5b8def", "#a9c7ff"],
    {},
  ),
  preset(
    "glass",
    "Glass",
    "Light frosted surface",
    ["#f3f5fb", "#6f97f5", "#dbe4ff"],
    {
      mode: "light",
      background: "glass",
      accentHue: 225,
      accentSpread: 24,
      vividness: 0.05,
      texture: 0.12,
      radius: 1.2,
      blur: 1.4,
    },
  ),
  preset(
    "mica",
    "Mica",
    "Solid surface with the Windows accent",
    ["#202020", "#0078d4", "#3d3d3d"],
    {
      mode: "system",
      background: "solid",
      accentHue: 206,
      accentSpread: 0,
      vividness: 0.04,
      texture: 0.2,
      radius: 0.6,
      blur: 0.6,
    },
  ),
  preset(
    "nord",
    "Nord",
    "Cool arctic blues",
    ["#2e3440", "#88c0d0", "#eceff4"],
    {
      background: "solid",
      useSystemAccent: false,
      accentHue: 230,
      accentSpread: 30,
      vividness: 0.05,
      texture: 0.1,
      radius: 0.5,
      blur: 0.8,
    },
  ),
  preset(
    "catppuccin",
    "Catppuccin",
    "Soft pastel mauve",
    ["#1e1e2e", "#cba6f7", "#f5c2e7"],
    {
      useSystemAccent: false,
      accentHue: 305,
      accentSpread: 40,
      vividness: 0.09,
      texture: 0.15,
      radius: 1.4,
      blur: 1.1,
    },
  ),
  preset(
    "dracula",
    "Dracula",
    "Purple and pink on charcoal",
    ["#282a36", "#bd93f9", "#ff79c6"],
    {
      useSystemAccent: false,
      accentHue: 290,
      accentSpread: 50,
      vividness: 0.14,
      texture: 0.25,
      radius: 0.8,
    },
  ),
  preset(
    "solarized",
    "Solarized",
    "Warm paper with amber accent",
    ["#fdf6e3", "#b58900", "#586e75"],
    {
      mode: "light",
      background: "solid",
      useSystemAccent: false,
      accentHue: 80,
      accentSpread: 20,
      vividness: 0.1,
      texture: 0.35,
      radius: 0.5,
      blur: 0.6,
    },
  ),
  preset(
    "mono",
    "Mono",
    "Greyscale, no accent",
    ["#111111", "#9a9a9a", "#f2f2f2"],
    {
      background: "solid",
      useSystemAccent: false,
      accentHue: 0,
      accentSpread: 0,
      vividness: 0,
      texture: 0.4,
      radius: 0.25,
      blur: 0.5,
      density: "compact",
    },
  ),
  preset(
    "neon",
    "Neon",
    "Vivid magenta and cyan glow",
    ["#0b0714", "#ff3cac", "#2bd2ff"],
    {
      useSystemAccent: false,
      accentHue: 325,
      accentSpread: 90,
      vividness: 0.2,
      texture: 0.15,
      radius: 1.6,
      blur: 1.3,
    },
  ),
  preset(
    "sunset",
    "Sunset",
    "Orange and gold on dusk",
    ["#2a1620", "#ff7a45", "#ffc46b"],
    {
      useSystemAccent: false,
      accentHue: 35,
      accentSpread: 45,
      vividness: 0.14,
      texture: 0.3,
      radius: 1.2,
      blur: 1.1,
    },
  ),
  preset(
    "forest",
    "Forest",
    "Mossy greens with grain",
    ["#12201a", "#4fb47a", "#c8e6c9"],
    {
      useSystemAccent: false,
      accentHue: 150,
      accentSpread: 30,
      vividness: 0.09,
      texture: 0.4,
      radius: 0.9,
      blur: 0.9,
    },
  ),
  preset(
    "ocean",
    "Ocean",
    "Deep teal currents",
    ["#0c1b24", "#2fb8c6", "#9fe3ec"],
    {
      useSystemAccent: false,
      accentHue: 200,
      accentSpread: 40,
      vividness: 0.11,
      texture: 0.2,
      radius: 1.1,
      blur: 1.2,
    },
  ),
]

const darkScheme = () => window.matchMedia("(prefers-color-scheme: dark)")

export const resolveMode = (mode: ThemeMode): "dark" | "light" => {
  if (mode !== "system") {
    return mode
  }

  return darkScheme().matches ? "dark" : "light"
}

export const applyAppearance = async (a: Appearance) => {
  const root = document.documentElement
  const systemHue = a.useSystemAccent
    ? await systemAccentHue().catch(() => null)
    : null
  const mode = resolveMode(a.mode)

  root.dataset.theme = mode === "light" ? "eris-light" : "eris"
  root.dataset.mode = mode
  root.dataset.background = a.background
  root.dataset.density = a.density
  root.dataset.motion = String(a.motion)

  const vars = {
    "--accent-hue": systemHue ?? a.accentHue,
    "--accent-spread": a.accentSpread,
    "--vividness": a.vividness,
    "--texture": a.texture,
    "--radius-scale": a.radius,
    "--blur-scale": a.blur,
    "--font-scale": a.fontScale,
    "--surface-opacity": a.surfaceOpacity,
    "--dock-opacity": a.dockOpacity,
  }

  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, String(value))
  }
}
