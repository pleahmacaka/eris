import { describe, expect, test } from "bun:test"
import { loadDmPreview, saveDmPreview } from "./listPrefs"

const memory = () => {
  const map = new Map<string, string>()

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

describe("dm preview preference", () => {
  test("is hidden by default", () => {
    expect(loadDmPreview(memory())).toBe(false)
  })

  test("persists on and off", () => {
    const storage = memory()

    saveDmPreview(storage, true)
    expect(loadDmPreview(storage)).toBe(true)
    saveDmPreview(storage, false)
    expect(loadDmPreview(storage)).toBe(false)
  })
})
