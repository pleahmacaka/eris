import { describe, expect, test } from "bun:test"
import {
  citedPath,
  citeLink,
  citeUrl,
  segments,
} from "../../../src/lib/markdown/cite"

describe("citation links", () => {
  test("round-trip a Korean path inside a folder", () => {
    const url = citeUrl("회의/9월 29일.md")

    expect(url).toBe(
      `arixlab-note://open?path=${encodeURIComponent("회의/9월 29일.md")}`,
    )
    expect(citedPath(url)).toBe("회의/9월 29일.md")
  })

  test("wrap the title in a markdown link", () => {
    expect(citeLink("a/회의록.md")).toBe(`[회의록](${citeUrl("a/회의록.md")})`)
  })

  test.each([
    ["traversal", "arixlab-note://open?path=..%2Fp2p.json"],
    ["canvas", "arixlab-note://open?path=board.canvas"],
    ["other action", "arixlab-note://delete?path=a.md"],
    ["other scheme", "https://open?path=a.md"],
    ["missing path", "arixlab-note://open"],
    ["garbage", "not a url"],
  ])("reject %s", (_, url) => {
    expect(citedPath(url)).toBeNull()
  })
})

describe("segments", () => {
  test("split text around markdown and bare citations", () => {
    const text = `안건 ${citeLink("a.md")} 참고 ${citeUrl("b/c.md")} 끝`

    expect(segments(text)).toEqual([
      { text: "안건 " },
      { label: "a", path: "a.md" },
      { text: " 참고 " },
      { label: "c", path: "b/c.md" },
      { text: " 끝" },
    ])
  })

  test("leave invalid citations as plain text", () => {
    const text = "[x](arixlab-note://open?path=..%2Fsecret.md)"

    expect(segments(text)).toEqual([{ text }])
  })
})
