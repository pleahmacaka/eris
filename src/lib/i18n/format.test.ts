import { describe, expect, test } from "bun:test"
import { createFormatters } from "./format"

const noon = Date.UTC(2026, 10, 22, 12)

describe("createFormatters", () => {
  test("Persian uses Persian digits and the Iranian calendar", () => {
    const fa = createFormatters("fa")
    expect(fa.number(1234.5)).toBe("۱٬۲۳۴٫۵")
    expect(fa.date(noon, { dateStyle: "long", timeZone: "UTC" })).toBe(
      "۱ آذر ۱۴۰۵",
    )
    expect(new Intl.DateTimeFormat("fa").resolvedOptions().calendar).toBe(
      "persian",
    )
  })

  test("numbers follow the locale separators", () => {
    expect(createFormatters("de").number(1234.5)).toBe("1.234,5")
    expect(createFormatters("en").number(1234.5)).toBe("1,234.5")
  })

  test("relative time picks the largest fitting unit", () => {
    const en = createFormatters("en")
    expect(en.relative(noon - 30_000, noon)).toBe("30 seconds ago")
    expect(en.relative(noon - 5 * 60_000, noon)).toBe("5 minutes ago")
    expect(en.relative(noon - 24 * 3_600_000, noon)).toBe("yesterday")
    expect(createFormatters("ko").relative(noon + 2 * 3_600_000, noon)).toBe(
      "2시간 후",
    )
  })

  test("file sizes scale by 1000 with localized units", () => {
    const en = createFormatters("en")
    expect(en.fileSize(512)).toBe("512 byte")
    expect(en.fileSize(1_500)).toBe("1.5 kB")
    expect(en.fileSize(2_300_000)).toBe("2.3 MB")
    expect(createFormatters("de").fileSize(1_500_000)).toBe("1,5 MB")
  })
})
