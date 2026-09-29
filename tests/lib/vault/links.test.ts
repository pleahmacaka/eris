import { describe, expect, test } from "bun:test"
import {
  backlinks,
  linkText,
  outgoing,
  parseLinks,
  resolveLink,
} from "../../../src/lib/vault/links"

describe("parseLinks", () => {
  test("reads target, heading and alias", () => {
    const [link] = parseLinks("앞 [[회의록#결정|결론]] 뒤")

    expect(link).toMatchObject({
      target: "회의록",
      heading: "결정",
      alias: "결론",
      from: 2,
    })
    expect(link.to).toBe(2 + "[[회의록#결정|결론]]".length)
  })

  test("finds embeds and several links on one line", () => {
    const links = parseLinks("![[그림]] 과 [[a]] 그리고 [[b]]")

    expect(links.map(l => l.target)).toEqual(["그림", "a", "b"])
  })

  test("ignores broken brackets", () => {
    expect(parseLinks("[[열림만 [한쪽] ]]")).toEqual([])
  })
})

describe("resolveLink", () => {
  const paths = [
    "a/회의록.md",
    "b/회의록.md",
    "c/깊은/회의록.md",
    "노트.md",
    "보드.canvas",
  ]

  test("matches a bare name with or without the extension", () => {
    expect(resolveLink("노트", "x.md", paths)).toBe("노트.md")
    expect(resolveLink("노트.md", "x.md", paths)).toBe("노트.md")
    expect(resolveLink("보드.canvas", "x.md", paths)).toBe("보드.canvas")
  })

  test("prefers the linking note's own folder", () => {
    expect(resolveLink("회의록", "b/오늘.md", paths)).toBe("b/회의록.md")
  })

  test("falls back to the shortest path", () => {
    expect(resolveLink("회의록", "z/오늘.md", paths)).toBe("a/회의록.md")
  })

  test("honours a folder-qualified target", () => {
    expect(resolveLink("c/깊은/회의록", "a/x.md", paths)).toBe(
      "c/깊은/회의록.md",
    )
  })

  test("returns null for a missing note", () => {
    expect(resolveLink("없음", "x.md", paths)).toBeNull()
  })
})

describe("graph helpers", () => {
  const paths = ["a.md", "b.md", "sub/b.md"]

  test("outgoing skips unresolved targets", () => {
    expect(outgoing("a.md", "[[b]] [[유령]]", paths)).toEqual(["b.md"])
  })

  test("backlinks report the linking line", () => {
    const texts = new Map([
      ["a.md", "첫 줄\n여기서 [[b]] 참조\n끝"],
      ["b.md", "[[b]] 자기 자신"],
    ])

    expect(backlinks("b.md", texts, paths)).toEqual([
      { path: "a.md", line: "여기서 [[b]] 참조" },
    ])
  })

  test("linkText qualifies names that are not unique", () => {
    expect(linkText("a.md", paths)).toBe("a")
    expect(linkText("sub/b.md", paths)).toBe("sub/b")
  })
})
