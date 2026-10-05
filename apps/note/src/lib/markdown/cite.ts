import { NOTE_SCHEME, notePathOf, noteUrl } from "@eris/bridge"
import { filePath, isNote, stem } from "../vault/paths"

export type Segment = { text: string } | { label: string; path: string }

const CITATION = new RegExp(
  `\\[([^\\]\\n]*)\\]\\((${NOTE_SCHEME}://[^)\\s]+)\\)|(${NOTE_SCHEME}://\\S+)`,
  "g",
)

export const citeUrl = noteUrl

export const citeLink = (path: string) => `[${stem(path)}](${citeUrl(path)})`

export const citedPath = (url: string): string | null => {
  const path = notePathOf(url)

  return path && filePath(path) === path && isNote(path) ? path : null
}

export const segments = (text: string): Segment[] => {
  const parts: Segment[] = []
  let last = 0

  for (const match of text.matchAll(CITATION)) {
    const path = citedPath(match[2] ?? match[3])

    if (!path) {
      continue
    }

    parts.push({ text: text.slice(last, match.index) })
    parts.push({ label: match[1] || stem(path), path })
    last = match.index + match[0].length
  }

  parts.push({ text: text.slice(last) })

  return parts.filter(part => !("text" in part) || part.text !== "")
}
