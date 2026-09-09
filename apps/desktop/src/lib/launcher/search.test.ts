import { describe, expect, test } from "bun:test"
import {
  groupResults,
  isChoseongQuery,
  openTarget,
  parseQuery,
  rank,
  score,
} from "./search"
import type { Result } from "./types"

const result = (over: Partial<Result>): Result => ({
  id: "x",
  kind: "app",
  title: "x",
  subtitle: "",
  icon: "lucide:app-window",
  action: () => undefined,
  secondaryActions: [],
  score: 0,
  ...over,
})

describe("score", () => {
  test("exact beats prefix beats word start beats subsequence", () => {
    const exact = score("Code", "code")
    const prefix = score("Code Editor", "code")
    const word = score("Visual Studio Code", "code")
    const fuzzy = score("Visual Studio Code", "vsc")

    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(word)
    expect(word).toBeGreaterThan(fuzzy)
    expect(fuzzy).toBeGreaterThan(0)
  })

  test("no match scores zero", () => {
    expect(score("Calculator", "xyz")).toBe(0)
    expect(score("Calculator", "")).toBe(0)
  })

  test("case and accents are ignored", () => {
    expect(score("Pokémon", "pokemon")).toBeGreaterThan(0)
    expect(score("NOTEPAD", "note")).toBe(score("notepad", "note"))
  })

  test("shorter titles win on equal matches", () => {
    expect(score("Terminal", "term")).toBeGreaterThan(
      score("Terminal Preview", "term"),
    )
  })

  test("contiguous and boundary matches outrank scattered ones", () => {
    expect(score("Visual Studio Code", "vsc")).toBeGreaterThan(
      score("Advanced System Care", "vsc"),
    )
  })

  test("korean choseong", () => {
    expect(isChoseongQuery("ㅋㅋㅇㅌ")).toBe(true)
    expect(isChoseongQuery("카카오")).toBe(false)
    expect(score("카카오톡", "ㅋㅋㅇㅌ")).toBeGreaterThan(0)
    expect(score("카카오톡", "ㅋㅋ")).toBeGreaterThan(score("카카오톡", "ㅇㅌ"))
    expect(score("카카오톡", "ㅋㅋㅇㅌ")).toBeGreaterThan(
      score("메모장", "ㅋㅋ"),
    )
    expect(score("메모장", "ㅋㅋ")).toBe(0)
    expect(score("카카오톡 KakaoTalk", "ㅋㅋ")).toBeGreaterThan(0)
  })

  test("korean syllables match as plain text", () => {
    expect(score("카카오톡", "카카")).toBeGreaterThan(0)
    expect(score("카카오톡", "오톡")).toBeGreaterThan(0)
  })
})

describe("rank", () => {
  test("keeps matches, adds frecency boost, keeps keywords", () => {
    const items = [
      result({ id: "a", title: "Chrome" }),
      result({ id: "b", title: "Calculator" }),
      result({ id: "c", title: "Shut down", keywords: ["power off"] }),
    ]
    const ranked = rank(items, "c", id => (id === "b" ? 100 : 0))

    expect(ranked.map(r => r.id)).toEqual(["a", "b"])
    expect(ranked[1].score).toBeGreaterThan(ranked[0].score)
    expect(rank(items, "power", () => 0).map(r => r.id)).toEqual(["c"])
  })
})

describe("groupResults", () => {
  test("groups by kind, caps per kind, keeps web last, best group first", () => {
    const items = [
      result({ id: "a1", kind: "app", score: 500 }),
      result({ id: "a2", kind: "app", score: 900 }),
      result({ id: "a3", kind: "app", score: 700 }),
      result({ id: "w1", kind: "web", score: 0 }),
      result({ id: "c1", kind: "command", score: 950 }),
    ]
    const groups = groupResults(items, kind => (kind === "app" ? 2 : 5))

    expect(groups.map(g => g.kind)).toEqual(["command", "app", "web"])
    expect(groups[1].items.map(r => r.id)).toEqual(["a2", "a3"])
    expect(groups.map(g => g.start)).toEqual([0, 1, 3])
  })
})

describe("parseQuery", () => {
  test("routes prefixes", () => {
    expect(parseQuery("> notepad")).toEqual({ mode: "run", text: "notepad" })
    expect(parseQuery("todo buy milk")).toEqual({
      mode: "todo",
      text: "buy milk",
    })
    expect(parseQuery("t buy milk")).toEqual({ mode: "todo", text: "buy milk" })
    expect(parseQuery("+buy milk")).toEqual({ mode: "todo", text: "buy milk" })
    expect(parseQuery("= 1 + 1")).toEqual({ mode: "calc", text: "1 + 1" })
    expect(parseQuery("clip x")).toEqual({ mode: "clip", text: "x" })
    expect(parseQuery("v x")).toEqual({ mode: "clip", text: "x" })
    expect(parseQuery("c x")).toEqual({ mode: "clip", text: "x" })
    expect(parseQuery("clip ")).toEqual({ mode: "clip", text: "" })
    expect(parseQuery("  chrome ")).toEqual({ mode: "search", text: "chrome" })
  })

  test("bare words that look like prefixes stay searches", () => {
    expect(parseQuery("todo")).toEqual({ mode: "search", text: "todo" })
    expect(parseQuery("terminal")).toEqual({
      mode: "search",
      text: "terminal",
    })
    expect(parseQuery("t")).toEqual({ mode: "search", text: "t" })
    expect(parseQuery("clipboard")).toEqual({
      mode: "search",
      text: "clipboard",
    })
    expect(parseQuery("chrome")).toEqual({ mode: "search", text: "chrome" })
  })

  test("emoji prefixes", () => {
    expect(parseQuery(":rocket")).toEqual({ mode: "emoji", text: "rocket" })
    expect(parseQuery("e rocket")).toEqual({ mode: "emoji", text: "rocket" })
    expect(parseQuery("emoji ")).toEqual({ mode: "emoji", text: "" })
    expect(parseQuery("edge")).toEqual({ mode: "search", text: "edge" })
  })

  test("timer and alarm prefixes carry their kind", () => {
    expect(parseQuery("timer 5m tea")).toEqual({
      mode: "timer",
      kind: "timer",
      text: "5m tea",
    })
    expect(parseQuery("alarm")).toEqual({
      mode: "timer",
      kind: "alarm",
      text: "",
    })
    expect(parseQuery("alarms")).toEqual({ mode: "search", text: "alarms" })
  })
})

describe("openTarget", () => {
  test("urls get a scheme, paths pass through", () => {
    expect(openTarget("https://example.com/x")).toBe("https://example.com/x")
    expect(openTarget("example.com")).toBe("https://example.com")
    expect(openTarget("www.example.com")).toBe("https://www.example.com")
    expect(openTarget("C:\\Users")).toBe("C:\\Users")
    expect(openTarget("\\\\server\\share")).toBe("\\\\server\\share")
  })

  test("plain words and math are not targets", () => {
    expect(openTarget("chrome")).toBeNull()
    expect(openTarget("3.14")).toBeNull()
    expect(openTarget("two words.com")).toBeNull()
  })
})
