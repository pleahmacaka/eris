import { NOTE_SCHEME, notePathOf } from "@eris/bridge"
import { katex } from "@mdit/plugin-katex"
import { tasklist } from "@mdit/plugin-tasklist"
import katexEngine from "katex"
import markdownit, { type MarkdownIt, type StateInline } from "markdown-it"
import { parseLinks } from "./links"

const wikilinks = (md: MarkdownIt) => {
  md.inline.ruler.before(
    "link",
    "wikilink",
    (state: StateInline, silent: boolean) => {
      const rest = state.src.slice(state.pos)
      const offset = rest.startsWith("![[") ? 1 : 0

      if (!rest.startsWith("[[", offset)) {
        return false
      }

      const link = parseLinks(rest.slice(0, rest.indexOf("]]") + 2))[0]

      if (link?.from !== 0) {
        return false
      }

      if (!silent) {
        const open = state.push("wikilink_open", "a", 1)

        open.attrSet("class", "wikilink")
        open.attrSet("href", "#")
        open.attrSet("data-target", link.target)

        const text = state.push("text", "", 0)

        text.content = link.alias ?? link.target

        state.push("wikilink_close", "a", -1)
      }

      state.pos += link.to

      return true
    },
  )
}

const noteTitle = (path: string) => {
  const file = path.slice(path.lastIndexOf("/") + 1)

  return file.toLowerCase().endsWith(".md") ? file.slice(0, -3) : file
}

const noteLinks = (md: MarkdownIt) => {
  md.linkify.add(`${NOTE_SCHEME}:`, {
    validate: (text, pos) =>
      text.slice(pos).match(/^\/\/open\?path=[^\s)]+/)?.[0].length ?? 0,
  })

  const fallback: NonNullable<typeof md.renderer.rules.link_open> = (
    tokens,
    index,
    options,
    _env,
    self,
  ) => self.renderToken(tokens, index, options)

  const open = md.renderer.rules.link_open ?? fallback

  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index]
    const href = String(token.attrGet("href") ?? "")
    const path = notePathOf(href)

    if (path) {
      token.attrJoin("class", "note-cite")
      token.attrSet("data-note-path", path)

      const label = tokens[index + 1]

      if (token.markup === "linkify" && label?.type === "text") {
        label.content = noteTitle(path)
      }
    } else if (/^https?:/i.test(href)) {
      token.attrSet("data-external", "")
    }

    return open(tokens, index, options, env, self)
  }
}

const build = (html: boolean) =>
  markdownit({ html, linkify: true, breaks: true })
    .use(wikilinks)
    .use(katex, { throwOnError: false, mathFence: true })
    .use(noteLinks)
    .use(tasklist, { label: false })

const safe = build(false)
const trusted = build(true)

export const renderMarkdown = (text: string, allowHtml = false) =>
  (allowHtml ? trusted : safe).render(text)

export const renderMath = (tex: string, display = false) =>
  katexEngine.renderToString(tex, { throwOnError: false, displayMode: display })

export const withoutFrontmatter = (markdown: string) => {
  const lines = markdown.split("\n")

  if (lines[0]?.trim() !== "---") {
    return markdown.trim()
  }

  const close = lines.indexOf("---", 1)

  return lines
    .slice(close < 0 ? 0 : close + 1)
    .join("\n")
    .trim()
}
