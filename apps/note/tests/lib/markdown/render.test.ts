import { describe, expect, test } from "bun:test"
import { outline } from "../../../src/lib/markdown/outline"
import { renderMarkdown } from "../../../src/lib/markdown/render"
import { fillTemplate } from "../../../src/lib/markdown/template"

describe("renderMarkdown", () => {
  test("turns wikilinks into anchors carrying the target", () => {
    const html = renderMarkdown("보기 [[회의록|결론]] 끝")

    expect(html).toContain(
      '<a class="wikilink" href="#" data-target="회의록">결론</a>',
    )
  })

  test("escapes raw html unless scripts are allowed", () => {
    const source = "<script>alert(1)</script>"

    expect(renderMarkdown(source)).not.toContain("<script>")
    expect(renderMarkdown(source, true)).toContain("<script>")
  })

  test("refuses javascript links", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain(
      'href="javascript:',
    )
  })
})

describe("outline", () => {
  test("lists headings with their line numbers and skips code fences", () => {
    const text = ["# 하나", "본문", "```", "# 코드", "```", "## 둘 ##"].join(
      "\n",
    )

    expect(outline(text)).toEqual([
      { level: 1, text: "하나", line: 1 },
      { level: 2, text: "둘", line: 6 },
    ])
  })
})

describe("fillTemplate", () => {
  test("replaces title, date and time", () => {
    const now = new Date(2026, 8, 29, 7, 5)

    expect(
      fillTemplate("# {{title}} {{date}} {{time}} {{title}}", "회의", now),
    ).toBe("# 회의 2026-09-29 07:05 회의")
  })
})
