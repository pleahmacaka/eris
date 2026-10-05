import { describe, expect, test } from "bun:test"
import {
  basename,
  dirname,
  filePath,
  folderPath,
  isCanvas,
  isNote,
  safeName,
  sameIgnoringCase,
  stem,
} from "../../../src/lib/vault/paths"

describe("filePath", () => {
  test("accepts vault-relative note and canvas paths", () => {
    expect(filePath("노트.md")).toBe("노트.md")
    expect(filePath("a/b/c.mdx")).toBe("a/b/c.mdx")
    expect(filePath("보드.canvas")).toBe("보드.canvas")
    expect(filePath("A/Note.MD")).toBe("A/Note.MD")
  })

  test.each([
    ["empty", ""],
    ["parent segment", "../p2p.json"],
    ["nested parent segment", "a/../b.md"],
    ["current segment", "./a.md"],
    ["absolute posix", "/a.md"],
    ["leading backslash", "\\a.md"],
    ["drive letter", "C:/a.md"],
    ["backslash separator", "a\\b.md"],
    ["colon", "a:b.md"],
    ["dot folder", ".obsidian/x.md"],
    ["dot file", "a/.hidden.md"],
    ["trailing dot segment", "a./b.md"],
    ["empty segment", "a//b.md"],
    ["trailing slash", "a/"],
    ["padded segment", " a.md"],
    ["foreign extension", "a/b.json"],
    ["no extension", "a/readme"],
  ])("rejects %s", (_, input) => {
    expect(filePath(input)).toBeNull()
  })

  test("normalizes to NFC so the same name maps to one path", () => {
    const decomposed = "한글.md".normalize("NFD")

    expect(filePath(decomposed)).toBe("한글.md")
  })
})

describe("folderPath", () => {
  test("treats the empty string as the vault root", () => {
    expect(folderPath("")).toBe("")
  })

  test("accepts nested folders and rejects traversal", () => {
    expect(folderPath("a/b")).toBe("a/b")
    expect(folderPath("a/../b")).toBeNull()
    expect(folderPath(".git")).toBeNull()
  })
})

describe("safeName", () => {
  test("replaces characters Windows cannot store", () => {
    expect(safeName("회의: 질문?")).not.toMatch(/[:?]/)
    expect(safeName("a/b\\c")).not.toMatch(/[/\\]/)
  })

  test("drops leading dots so a name never hides itself", () => {
    expect(safeName("..secret")).toBe("secret")
  })

  test("avoids reserved device names", () => {
    expect(safeName("CON").toUpperCase()).not.toBe("CON")
  })
})

describe("path parts", () => {
  test("splits names, folders and stems", () => {
    expect(basename("a/b/c.md")).toBe("c.md")
    expect(dirname("a/b/c.md")).toBe("a/b")
    expect(dirname("c.md")).toBe("")
    expect(stem("a/b/c.d.md")).toBe("c.d")
  })

  test("classifies by extension without caring about case", () => {
    expect(isNote("a.MD")).toBe(true)
    expect(isNote("a.mdx")).toBe(true)
    expect(isNote("a.canvas")).toBe(false)
    expect(isCanvas("a.Canvas")).toBe(true)
  })

  test("compares names the way Windows does", () => {
    expect(sameIgnoringCase("Note.md", "note.MD")).toBe(true)
    expect(sameIgnoringCase("a.md", "b.md")).toBe(false)
  })
})
