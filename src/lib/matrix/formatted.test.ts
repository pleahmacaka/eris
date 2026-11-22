import { describe, expect, test } from "bun:test"
import {
  decodeEntities,
  type FormattedNode,
  parseFormattedBody,
  plainText,
} from "./formatted"

const text = (value: string): FormattedNode => ({ type: "text", text: value })

const element = (
  tag: string,
  children: FormattedNode[],
  href: string | null = null,
): FormattedNode => ({ type: "element", tag, href, children })

describe("decodeEntities", () => {
  test("decodes named and numeric entities", () => {
    expect(
      decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#x27;"),
    ).toBe("a & b <c> \"d\" 'e'")
    expect(decodeEntities("&#54620;&#xAE00;")).toBe("한글")
  })

  test("keeps unknown or broken entities as text", () => {
    expect(decodeEntities("R&D; &unknown; &#x110000; &")).toBe(
      "R&D; &unknown; &#x110000; &",
    )
    expect(decodeEntities("no entities")).toBe("no entities")
  })
})

describe("parseFormattedBody", () => {
  test("keeps allowed inline and block tags", () => {
    expect(
      parseFormattedBody(
        "<p>안녕 <b>굵게</b> <code>x &lt; y</code></p><br/>끝",
      ),
    ).toEqual([
      element("p", [
        text("안녕 "),
        element("b", [text("굵게")]),
        text(" "),
        element("code", [text("x < y")]),
      ]),
      element("br", []),
      text("끝"),
    ])
  })

  test("keeps links with a safe scheme and their href", () => {
    expect(
      parseFormattedBody(
        '<a href="https://matrix.to/#/@bob:example.org" onclick="steal()">@bob</a>',
      ),
    ).toEqual([
      element("a", [text("@bob")], "https://matrix.to/#/@bob:example.org"),
    ])
    expect(parseFormattedBody("<A HREF='mailto:a@b.c'>mail</A>")).toEqual([
      element("a", [text("mail")], "mailto:a@b.c"),
    ])
    expect(
      parseFormattedBody('<a href="https://x.y/?a=1&amp;b=2">q</a>'),
    ).toEqual([element("a", [text("q")], "https://x.y/?a=1&b=2")])
  })

  test("drops the href of script and data links", () => {
    for (const href of [
      "javascript:alert(1)",
      " JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:x",
      "//evil.example",
    ]) {
      expect(parseFormattedBody(`<a href="${href}">x</a>`)).toEqual([
        element("a", [text("x")]),
      ])
    }
  })

  test("removes script, style and reply fallbacks with their content", () => {
    expect(
      parseFormattedBody(
        "a<script>alert(1)</script>b<style>p{}</style>c<mx-reply><blockquote>old</blockquote></mx-reply>d",
      ),
    ).toEqual([text("a"), text("b"), text("c"), text("d")])
    expect(parseFormattedBody("x<SCRIPT>alert(1)")).toEqual([text("x")])
  })

  test("unwraps unknown tags and keeps their text", () => {
    expect(
      parseFormattedBody(
        '<div class="x"><span style="color:red" onmouseover="x()">빨강</span><iframe src="https://x"></iframe><font color="red">f</font></div>',
      ),
    ).toEqual([text("빨강"), text("f")])
  })

  test("drops images and comments", () => {
    expect(
      parseFormattedBody('a<img src="x" onerror="alert(1)"><!-- hidden -->b'),
    ).toEqual([text("a"), text("b")])
  })

  test("closes tags that were left open or closed out of order", () => {
    expect(parseFormattedBody("<b>굵게 <i>둘 다</b> 뒤")).toEqual([
      element("b", [text("굵게 "), element("i", [text("둘 다")])]),
      text(" 뒤"),
    ])
    expect(parseFormattedBody("<ul><li>하나<li>둘")).toEqual([
      element("ul", [
        element("li", [text("하나"), element("li", [text("둘")])]),
      ]),
    ])
    expect(parseFormattedBody("앞</b>뒤")).toEqual([text("앞"), text("뒤")])
  })

  test("treats a stray angle bracket as text", () => {
    expect(parseFormattedBody("1 < 2 and 3 > 2")).toEqual([
      text("1 "),
      text("<"),
      text(" 2 and 3 > 2"),
    ])
  })

  test("stops nesting at the depth limit", () => {
    const nodes = parseFormattedBody(`${"<b>".repeat(500)}깊이`)
    let depth = 0
    let current = nodes[0]

    while (current?.type === "element") {
      depth += 1
      current = current.children[0]
    }

    expect(depth).toBeLessThan(101)
    expect(plainText(nodes)).toBe("깊이")
  })
})

describe("plainText", () => {
  test("joins the text of nested nodes", () => {
    expect(
      plainText(parseFormattedBody("<a href='https://x.y'>@<b>bob</b></a>!")),
    ).toBe("@bob!")
  })
})
