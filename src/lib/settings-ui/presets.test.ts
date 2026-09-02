import { expect, test } from "bun:test"
import type { Preset } from "$lib/data/types"
import { type Appearance, defaultAppearance } from "$lib/settings"
import { fromUser } from "./presets"

const stored = (appearance: Partial<Appearance>) =>
  ({
    id: "p1",
    name: "Mine",
    appearance,
    createdAt: 0,
    updatedAt: 0,
  }) as unknown as Preset

test("a preset missing fields still gets a valid swatch", () => {
  const preset = fromUser(stored({ mode: "light", accentHue: 30 }))

  expect(preset.appearance.accentSpread).toBe(defaultAppearance.accentSpread)
  expect(preset.swatch.join(" ")).not.toContain("NaN")
  expect(preset.swatch[0]).toContain("96%")
})
