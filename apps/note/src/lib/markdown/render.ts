import markdownit, { type MarkdownIt, type StateInline } from "markdown-it"
import { parseLinks } from "../vault/links"

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

const build = (html: boolean) =>
  markdownit({ html, linkify: true, breaks: true }).use(wikilinks)

const safe = build(false)
const trusted = build(true)

export const renderMarkdown = (text: string, allowHtml = false) =>
  (allowHtml ? trusted : safe).render(text)
