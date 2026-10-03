import { describe, expect, test } from "bun:test"
import { basename } from "node:path"
import { fileURLToPath } from "node:url"
import { defaultAppearance } from "@eris/settings"
import { Glob } from "bun"
import { type CommunityTheme, toolsOf } from "../src/support"

const folder = fileURLToPath(new URL("../themes/", import.meta.url))

const files = [...new Glob("*.json").scanSync(folder)]

const HEX = new Set("0123456789abcdef")

const isHex = (color: string) =>
  color.length === 7 &&
  color.startsWith("#") &&
  [...color.slice(1).toLowerCase()].every(digit => HEX.has(digit))

describe("community themes", () => {
  test("the folder has themes", () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    test(file, async () => {
      const theme: CommunityTheme = await Bun.file(`${folder}/${file}`).json()

      expect(theme.id).toBe(basename(file, ".json"))
      expect(theme.name.trim()).not.toBe("")
      expect(theme.author.trim()).not.toBe("")
      expect(theme.description.trim()).not.toBe("")
      expect(theme.swatch).toHaveLength(3)
      expect(theme.swatch.every(isHex)).toBe(true)

      const entries = Object.entries(theme.appearance)

      expect(entries.length).toBeGreaterThan(0)

      for (const [key, value] of entries) {
        expect(key in defaultAppearance).toBe(true)
        expect(typeof value).toBe(
          typeof defaultAppearance[key as keyof typeof defaultAppearance],
        )
      }
    })
  }
})

describe("supported tools", () => {
  const theme = (appearance: CommunityTheme["appearance"]): CommunityTheme => ({
    id: "probe",
    name: "Probe",
    author: "Eris",
    description: "Probe",
    swatch: ["#000000", "#000000", "#000000"],
    appearance,
  })

  test("dock keys alone reach only the Eris dock", () => {
    expect(toolsOf(theme({ dockBlur: 1.2, dockBorder: false }))).toEqual([
      "eris",
    ])
  })

  test("any shared key reaches every tool", () => {
    expect(toolsOf(theme({ accentHue: 120, dockBlur: 1.2 }))).toEqual([
      "eris",
      "files",
      "terminal",
    ])
  })
})
