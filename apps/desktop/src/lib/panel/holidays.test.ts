import { describe, expect, test } from "bun:test"
import { holidaysOn, systemRegion } from "./holidays"

describe("holidaysOn", () => {
  test("korean chuseok falls on the lunar harvest dates", () => {
    expect(holidaysOn(new Date(2025, 9, 6), "KR", "ko")).toContain("추석")
    expect(holidaysOn(new Date(2024, 8, 17), "KR", "ko")).toContain("추석")
    expect(holidaysOn(new Date(2026, 8, 25), "KR", "ko")).toContain("추석")
  })

  test("korean new year and substitute holidays resolve", () => {
    expect(holidaysOn(new Date(2025, 0, 29), "KR", "ko")).toContain("설날")

    const substitute = holidaysOn(new Date(2025, 9, 8), "KR", "ko")

    expect(substitute.some(name => name.includes("대체공휴일"))).toBe(true)
  })

  test("unknown regions return an empty list instead of throwing", () => {
    expect(holidaysOn(new Date(2025, 9, 6), "XX", "en")).toEqual([])
  })
})

describe("systemRegion", () => {
  test("returns an uppercase two-letter region", () => {
    expect(systemRegion()).toMatch(/^[A-Z]{2}$/)
  })
})
