import { describe, expect, test } from "bun:test"
import { NOTE_LINK, notePathOf, noteUrl } from "./link"
import { crossesApps } from "./snapshot"

describe("note links", () => {
  test("round-trip a Korean path inside a folder", () => {
    const url = noteUrl("회의/9월 29일.md")

    expect(url.startsWith(NOTE_LINK)).toBe(true)
    expect(notePathOf(url)).toBe("회의/9월 29일.md")
  })

  test("store paths in NFC", () => {
    expect(noteUrl("회의.md".normalize("NFD"))).toBe(noteUrl("회의.md"))
  })

  test.each([
    ["other action", "arixlab-note://delete?path=a.md"],
    ["other scheme", "https://open?path=a.md"],
    ["missing path", "arixlab-note://open"],
    ["empty path", "arixlab-note://open?path="],
    ["garbage", "not a url"],
  ])("reject %s", (_, url) => {
    expect(notePathOf(url)).toBeNull()
  })
})

describe("cross-app snapshots", () => {
  test("share only calendar events", () => {
    expect(crossesApps("events")).toBe(true)
    expect(crossesApps("todos")).toBe(false)
    expect(crossesApps("files")).toBe(false)
  })
})
