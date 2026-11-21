import { describe, expect, test } from "bun:test"
import {
  loadTitleBarSetting,
  saveTitleBarSetting,
  TITLE_BAR_KEY,
} from "./titleBar"

const storage = () => {
  const map = new Map<string, string>()

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

describe("title bar setting", () => {
  test("defaults to the custom title bar", () => {
    expect(loadTitleBarSetting(storage())).toBe(true)
  })

  test("persists off and on", () => {
    const store = storage()

    saveTitleBarSetting(store, false)
    expect(store.getItem(TITLE_BAR_KEY)).toBe("off")
    expect(loadTitleBarSetting(store)).toBe(false)
    saveTitleBarSetting(store, true)
    expect(loadTitleBarSetting(store)).toBe(true)
  })
})
