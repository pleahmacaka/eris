import type { Preset } from "$lib/data/types"
import { type Appearance, defaultAppearance } from "$lib/settings"
import { presets as builtIn, type PresetDefinition } from "$lib/theme"

export const CUSTOM = "custom"

const keys = Object.keys(defaultAppearance) as (keyof Appearance)[]

export const sameAppearance = (a: Appearance, b: Appearance) =>
  keys.every(key => a[key] === b[key])

const swatchFor = (a: Appearance): [string, string, string] => {
  const surface =
    a.mode === "light"
      ? `oklch(96% 0.01 ${a.accentHue})`
      : `oklch(22% 0.015 ${a.accentHue})`

  return [
    surface,
    `oklch(68% 0.16 ${a.accentHue})`,
    `oklch(82% 0.1 ${a.accentHue + a.accentSpread})`,
  ]
}

export const fromUser = (p: Preset): PresetDefinition => {
  const appearance = { ...defaultAppearance, ...p.appearance }

  return {
    id: p.id,
    name: p.name,
    description: "Saved from your settings",
    appearance,
    swatch: swatchFor(appearance),
  }
}

export const allPresets = (user: Preset[]) => [
  ...builtIn,
  ...user.map(fromUser),
]

export const matchPreset = (list: PresetDefinition[], appearance: Appearance) =>
  list.find(p => sameAppearance(p.appearance, appearance))?.id ?? CUSTOM
