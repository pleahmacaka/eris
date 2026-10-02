import { type Appearance, presetAppearances } from "@eris/settings"

export { applyAppearance, resolveMode } from "@eris/settings"

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
): PresetDefinition => ({
  id,
  name,
  description,
  swatch,
  appearance: { ...presetAppearances[id] },
})

export const presets: PresetDefinition[] = [
  preset("arix", "Arix", "Flat near-black with soft corners", [
    "#131018",
    "#ac89e8",
    "#e8e7ed",
  ]),
  preset("aurora", "Aurora", "Drifting orbs on deep blue", [
    "#1b1b26",
    "#5b8def",
    "#a9c7ff",
  ]),
  preset("glass", "Glass", "Light frosted surface", [
    "#f3f5fb",
    "#6f97f5",
    "#dbe4ff",
  ]),
  preset("mica", "Mica", "Solid surface with the Windows accent", [
    "#202020",
    "#0078d4",
    "#3d3d3d",
  ]),
  preset("nord", "Nord", "Cool arctic blues", [
    "#2e3440",
    "#88c0d0",
    "#eceff4",
  ]),
  preset("catppuccin", "Catppuccin", "Soft pastel mauve", [
    "#1e1e2e",
    "#cba6f7",
    "#f5c2e7",
  ]),
  preset("dracula", "Dracula", "Purple and pink on charcoal", [
    "#282a36",
    "#bd93f9",
    "#ff79c6",
  ]),
  preset("solarized", "Solarized", "Warm paper with amber accent", [
    "#fdf6e3",
    "#b58900",
    "#586e75",
  ]),
  preset("mono", "Mono", "Greyscale, no accent", [
    "#111111",
    "#9a9a9a",
    "#f2f2f2",
  ]),
  preset("neon", "Neon", "Vivid magenta and cyan glow", [
    "#0b0714",
    "#ff3cac",
    "#2bd2ff",
  ]),
  preset("sunset", "Sunset", "Orange and gold on dusk", [
    "#2a1620",
    "#ff7a45",
    "#ffc46b",
  ]),
  preset("forest", "Forest", "Mossy greens with grain", [
    "#12201a",
    "#4fb47a",
    "#c8e6c9",
  ]),
  preset("ocean", "Ocean", "Deep teal currents", [
    "#0c1b24",
    "#2fb8c6",
    "#9fe3ec",
  ]),
]
