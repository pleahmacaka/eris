import { describe, expect, test } from "bun:test"
import { basename } from "node:path"
import { fileURLToPath } from "node:url"
import { defaultAppearance } from "@eris/settings"
import { Glob } from "bun"
import { browse, type CommunityTheme, toolsOf } from "../src/support"

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
      const SLUG = new Set("abcdefghijklmnopqrstuvwxyz0123456789-")

      expect(theme.id).toBe(basename(file, ".json"))
      expect(theme.name.trim()).not.toBe("")
      expect(theme.author.trim()).not.toBe("")
      expect(theme.description.trim()).not.toBe("")
      expect(theme.swatch).toHaveLength(3)
      expect(theme.swatch.every(isHex)).toBe(true)
      expect(theme.tags.length).toBeLessThanOrEqual(6)
      expect(theme.tags.every(tag => [...tag].every(c => SLUG.has(c)))).toBe(true)

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
  const theme = (
    appearance: CommunityTheme["appearance"],
    extra: Partial<CommunityTheme> = {},
  ): CommunityTheme => ({
    id: "probe",
    slug: "probe",
    owner: null,
    name: "Probe",
    author: "Eris",
    description: "Probe",
    swatch: ["#000000", "#000000", "#000000"],
    appearance,
    tags: [],
    likes: 0,
    downloads: 0,
    created_at: "",
    ...extra,
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

  test("browse searches, filters and sorts", () => {
    const list = [
      theme({ mode: "light", accentHue: 80 }, { id: "a", name: "Paper", likes: 1, tags: ["warm"] }),
      theme({ mode: "dark", accentHue: 230 }, { id: "b", name: "Night", likes: 5 }),
      theme({ dockBlur: 1.5 }, { id: "c", name: "Dock", downloads: 2 }),
    ]
    const ids = (query: Partial<Parameters<typeof browse>[1]>) =>
      browse(list, { q: "", sort: "popular", tool: "", mode: "", tag: "", ...query }).map(t => t.id)

    expect(ids({})).toEqual(["b", "a", "c"])
    expect(ids({ mode: "light" })).toEqual(["a", "c"])
    expect(ids({ tool: "files" })).toEqual(["b", "a"])
    expect(ids({ tag: "warm" })).toEqual(["a"])
    expect(ids({ q: "nig" })).toEqual(["b"])
    expect(ids({ sort: "name" })).toEqual(["c", "b", "a"])
  })
})
