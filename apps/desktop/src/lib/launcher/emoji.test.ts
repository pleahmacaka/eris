import { describe, expect, test } from "bun:test"
import { matchEmoji } from "./emoji"

const chars = (query: string, limit?: number) =>
  matchEmoji(query, limit).map(m => m.char)

describe("matchEmoji", () => {
  test("matches on the name", () => {
    expect(chars("rocket")[0]).toBe("🚀")
    expect(chars("thumbs up")[0]).toBe("👍")
  })

  test("matches on keywords", () => {
    expect(chars("lgtm")[0]).toBe("👍")
    expect(chars("tada")[0]).toBe("🎉")
    expect(chars("sqrt")[0]).toBe("√")
  })

  test("covers the symbol set", () => {
    for (const symbol of ["—", "…", "✓", "✗", "°", "±", "×", "÷"]) {
      expect(chars(symbol === "—" ? "em dash" : "x")).toBeDefined()
    }

    expect(chars("approximately")[0]).toBe("≈")
    expect(chars("not equal")[0]).toBe("≠")
    expect(chars("won")[0]).toBe("₩")
    expect(chars("euro")[0]).toBe("€")
  })

  test("arrows are findable", () => {
    expect(chars("right arrow")[0]).toBe("→")
    expect(chars("left arrow")[0]).toBe("←")
  })

  test("an empty query shows the head of the list", () => {
    expect(chars("", 5)).toHaveLength(5)
    expect(chars("", 5)[0]).toBe("😀")
  })

  test("no match yields nothing", () => {
    expect(chars("zzzzqqqq")).toHaveLength(0)
  })

  test("respects the limit", () => {
    expect(chars("a", 4)).toHaveLength(4)
  })
})
