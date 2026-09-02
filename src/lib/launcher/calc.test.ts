import { describe, expect, test } from "bun:test"
import { evaluate, formatNumber, looksLikeMath, plainNumber } from "./calc"

const calc = (input: string) => {
  const outcome = evaluate(input)

  return outcome && "value" in outcome ? outcome.value : null
}

describe("evaluate", () => {
  test("arithmetic and precedence", () => {
    expect(calc("1 + 2 * 3")).toBe(7)
    expect(calc("(1 + 2) * 3")).toBe(9)
    expect(calc("10 / 4")).toBe(2.5)
    expect(calc("10 % 3")).toBe(1)
    expect(calc("2 ^ 3 ^ 2")).toBe(512)
    expect(calc("-2 ^ 2")).toBe(-4)
    expect(calc("2 ^ -1")).toBe(0.5)
  })

  test("functions and constants", () => {
    expect(calc("sqrt(16)")).toBe(4)
    expect(calc("sin(0)")).toBe(0)
    expect(calc("cos(0)")).toBe(1)
    expect(calc("tan(0)")).toBe(0)
    expect(calc("pi")).toBeCloseTo(Math.PI)
    expect(calc("e")).toBeCloseTo(Math.E)
    expect(calc("2pi")).toBeCloseTo(2 * Math.PI)
    expect(calc("2(3 + 4)")).toBe(14)
  })

  test("percent", () => {
    expect(calc("50%")).toBe(0.5)
    expect(calc("200 * 10%")).toBe(20)
  })

  test("number formats", () => {
    expect(calc("1,000 + 1")).toBe(1001)
    expect(calc("1_000 * 2")).toBe(2000)
    expect(calc(".5 + .5")).toBe(1)
    expect(calc("3 × 4 ÷ 2")).toBe(6)
  })

  test("a decimal comma is not a thousands separator", () => {
    expect(calc("1,5 + 1")).toBeNull()
    expect(calc("1,00,000 + 1")).toBeNull()
  })

  test("rejects anything unsafe or malformed", () => {
    expect(calc("alert(1)")).toBeNull()
    expect(calc("process")).toBeNull()
    expect(calc("1 +")).toBeNull()
    expect(calc("(1 + 2")).toBeNull()
    expect(calc("1 2")).toBeNull()
    expect(calc("")).toBeNull()
    expect(calc("hello world")).toBeNull()
    expect(calc("1.2.3")).toBeNull()
  })

  test("reports impossible values instead of hiding them", () => {
    expect(evaluate("1 / 0")).toEqual({ error: "Division by zero" })
    expect(evaluate("0 / 0")).toEqual({ error: "Division by zero" })
    expect(evaluate("5 % 0")).toEqual({ error: "Division by zero" })
    expect(evaluate("9 ^ 9 ^ 9")).toEqual({ error: "Out of range" })
    expect(evaluate("sqrt(-1)")).toEqual({ error: "Undefined" })
    expect(evaluate("hello")).toBeNull()
  })
})

describe("looksLikeMath", () => {
  test("needs a digit and more than a plain number", () => {
    expect(looksLikeMath("2 + 2")).toBe(true)
    expect(looksLikeMath("sqrt(2)")).toBe(true)
    expect(looksLikeMath("42")).toBe(false)
    expect(looksLikeMath("3pm")).toBe(false)
    expect(looksLikeMath("chrome")).toBe(false)
    expect(looksLikeMath("2fa")).toBe(false)
    expect(looksLikeMath("1/0")).toBe(true)
  })
})

describe("formatting", () => {
  test("hides float noise and groups thousands", () => {
    expect(plainNumber(0.1 + 0.2)).toBe("0.3")
    expect(formatNumber(1234567.891)).toBe("1,234,567.891")
    expect(formatNumber(1 / 3)).toBe("0.3333333333")
  })
})
