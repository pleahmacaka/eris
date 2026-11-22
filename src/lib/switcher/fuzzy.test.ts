import { describe, expect, test } from "bun:test"
import { fold, fuzzyScore } from "./fuzzy"

const score = (query: string, text: string) =>
  fuzzyScore(fold(query).chars, fold(text))

const rank = (query: string, text: string) =>
  score(query, text) ?? Number.NEGATIVE_INFINITY

describe("fold", () => {
  test("lower-cases, drops separators and marks word starts", () => {
    expect(fold("Eris-Dev 2")).toEqual({
      chars: ["e", "r", "i", "s", "d", "e", "v", "2"],
      heads: [true, false, false, false, true, false, false, true],
    })
  })

  test("splits Hangul syllables into keystrokes", () => {
    expect(fold("개발")).toEqual({
      chars: ["ㄱ", "ㅐ", "ㅂ", "ㅏ", "ㄹ"],
      heads: [true, false, true, false, false],
    })
  })

  test("splits compound vowels and final consonants", () => {
    expect(fold("닭과").chars.join("")).toBe("ㄷㅏㄹㄱㄱㅗㅏ")
    expect(fold("ㄳ").chars.join("")).toBe("ㄱㅅ")
  })

  test("reads decomposed Hangul like composed Hangul", () => {
    expect(fold("개발".normalize("NFD"))).toEqual(fold("개발"))
  })
})

describe("fuzzyScore", () => {
  test("needs every query character in order", () => {
    expect(score("gen", "general")).not.toBeNull()
    expect(score("gnl", "general")).not.toBeNull()
    expect(score("neg", "general")).toBeNull()
    expect(score("general chat", "general")).toBeNull()
    expect(score("", "general")).toBeNull()
  })

  test("ignores case and separators", () => {
    expect(score("ERIS dev", "eris-dev")).toBe(score("erisdev", "Eris Dev"))
  })

  test("ranks a prefix over a later word and a later word over mid-word", () => {
    expect(rank("gen", "general")).toBeGreaterThan(rank("gen", "next gen"))
    expect(rank("gen", "next gen")).toBeGreaterThan(rank("gen", "regency"))
  })

  test("ranks a contiguous match over a scattered one", () => {
    expect(rank("gen", "regency")).toBeGreaterThan(rank("gen", "biggest win"))
  })

  test("ranks word initials over letters inside a word", () => {
    expect(rank("gc", "general chat")).toBeGreaterThan(rank("gc", "magic"))
  })

  test("ranks the shorter name first for the same match", () => {
    expect(rank("dev", "dev")).toBeGreaterThan(rank("dev", "dev-ops"))
  })

  test("matches Hangul by initial consonants", () => {
    expect(score("ㄱㅂ", "개발")).not.toBeNull()
    expect(score("ㅇㅂ", "일반 대화")).not.toBeNull()
    expect(score("ㄱㅂ", "일반")).toBeNull()
  })

  test("keeps matching while a Hangul syllable is still being composed", () => {
    expect(score("갭", "개발")).not.toBeNull()
    expect(score("개바", "개발")).not.toBeNull()
    expect(score("고", "과자")).not.toBeNull()
    expect(score("닭", "달걀")).not.toBeNull()
  })

  test("ranks typed syllables over initial consonants", () => {
    expect(rank("개발", "개발 채널")).toBeGreaterThan(rank("ㄱㅂ", "개발 채널"))
    expect(rank("개", "개발")).toBeGreaterThan(rank("개", "날개"))
  })
})
