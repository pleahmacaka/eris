import { describe, expect, test } from "bun:test"
import { LOCALES, negotiateLocale, parseLocalePreference } from "./locales"

describe("negotiateLocale", () => {
  test("matches every supported tag to itself", () => {
    for (const { tag } of LOCALES) {
      expect(negotiateLocale([tag])).toBe(tag)
    }
  })

  test("resolves regional and script variants", () => {
    expect(negotiateLocale(["en-GB"])).toBe("en")
    expect(negotiateLocale(["ko-KR"])).toBe("ko")
    expect(negotiateLocale(["fa-IR"])).toBe("fa")
    expect(negotiateLocale(["pt"])).toBe("pt-BR")
    expect(negotiateLocale(["pt-PT"])).toBe("pt-BR")
    expect(negotiateLocale(["zh"])).toBe("zh-Hans")
    expect(negotiateLocale(["zh-CN"])).toBe("zh-Hans")
    expect(negotiateLocale(["zh-SG"])).toBe("zh-Hans")
  })

  test("follows CLDR likely scripts for Serbian", () => {
    expect(negotiateLocale(["sr"])).toBe("sr-Cyrl")
    expect(negotiateLocale(["sr-RS"])).toBe("sr-Cyrl")
    expect(negotiateLocale(["sr-ME"])).toBe("sr-Latn")
    expect(negotiateLocale(["sr-Latn-RS"])).toBe("sr-Latn")
  })

  test("prefers a later exact script match over an earlier language-only match", () => {
    expect(negotiateLocale(["zh-TW", "en-US"])).toBe("en")
    expect(negotiateLocale(["zh-TW"])).toBe("zh-Hans")
  })

  test("falls back to English for unknown or invalid tags", () => {
    expect(negotiateLocale([])).toBe("en")
    expect(negotiateLocale(["sw-KE"])).toBe("en")
    expect(negotiateLocale(["*", "not a tag"])).toBe("en")
    expect(negotiateLocale(["*", "de-AT"])).toBe("de")
  })
})

describe("parseLocalePreference", () => {
  test("keeps known tags and treats anything else as system", () => {
    expect(parseLocalePreference("sr-Latn")).toBe("sr-Latn")
    expect(parseLocalePreference(null)).toBe("system")
    expect(parseLocalePreference("sr")).toBe("system")
    expect(parseLocalePreference("system")).toBe("system")
  })
})
