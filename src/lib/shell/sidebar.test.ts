import { describe, expect, test } from "bun:test"
import { clampWidth, loadWidth, SIDEBARS, saveWidth } from "./sidebar"

const memory = (entries: Record<string, string> = {}) => {
  const map = new Map(Object.entries(entries))

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

describe("sidebar width", () => {
  test("stays inside each sidebar's range", () => {
    expect(clampWidth("channels", 100)).toBe(200)
    expect(clampWidth("channels", 280.4)).toBe(280)
    expect(clampWidth("channels", 900)).toBe(360)
    expect(clampWidth("members", 100)).toBe(200)
    expect(clampWidth("members", 900)).toBe(320)
  })

  test("stops at the space the chat can give up", () => {
    expect(clampWidth("channels", 340, 300)).toBe(300)
    expect(clampWidth("channels", 340, 500)).toBe(340)
    expect(clampWidth("channels", 340, 120)).toBe(200)
  })

  test("starts at the default width", () => {
    expect(loadWidth(memory(), "channels")).toBe(240)
    expect(loadWidth(memory(), "members")).toBe(240)
  })

  test("ignores a stored value that is not a number", () => {
    expect(
      loadWidth(memory({ [SIDEBARS.channels.key]: "wide" }), "channels"),
    ).toBe(240)
  })

  test("pulls a stored value back into range", () => {
    expect(
      loadWidth(memory({ [SIDEBARS.members.key]: "999" }), "members"),
    ).toBe(320)
  })

  test("persists each sidebar on its own", () => {
    const storage = memory()

    saveWidth(storage, "channels", 312)
    saveWidth(storage, "members", 208)
    expect(loadWidth(storage, "channels")).toBe(312)
    expect(loadWidth(storage, "members")).toBe(208)
  })
})
