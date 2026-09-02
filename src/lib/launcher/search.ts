import { getChoseong } from "es-hangul"
import type { TimerKind } from "./timers"
import {
  groupLabels,
  type Result,
  type ResultGroup,
  type ResultKind,
} from "./types"

export type Route =
  | { mode: "run"; text: string }
  | { mode: "todo"; text: string }
  | { mode: "calc"; text: string }
  | { mode: "clip"; text: string }
  | { mode: "emoji"; text: string }
  | { mode: "timer"; text: string; kind: TimerKind }
  | { mode: "search"; text: string }

const TODO_PREFIXES = ["todo ", "t "]
const CLIP_PREFIXES = ["clip ", "v ", "c "]
const EMOJI_PREFIXES = ["emoji ", "e "]
const TIMER_KINDS: TimerKind[] = ["timer", "alarm"]

export const parseQuery = (raw: string): Route => {
  const text = raw.trimStart()

  if (text.startsWith(">")) {
    return { mode: "run", text: text.slice(1).trim() }
  }

  if (text.startsWith("+")) {
    return { mode: "todo", text: text.slice(1).trim() }
  }

  if (text.startsWith("=")) {
    return { mode: "calc", text: text.slice(1).trim() }
  }

  if (text.startsWith(":")) {
    return { mode: "emoji", text: text.slice(1).trim() }
  }

  const lower = text.toLowerCase()
  const prefix = TODO_PREFIXES.find(p => lower.startsWith(p))

  if (prefix) {
    return { mode: "todo", text: text.slice(prefix.length).trim() }
  }

  const clip = CLIP_PREFIXES.find(p => lower.startsWith(p))

  if (clip) {
    return { mode: "clip", text: text.slice(clip.length).trim() }
  }

  const emoji = EMOJI_PREFIXES.find(p => lower.startsWith(p))

  if (emoji) {
    return { mode: "emoji", text: text.slice(emoji.length).trim() }
  }

  const kind = TIMER_KINDS.find(k => lower === k || lower.startsWith(`${k} `))

  if (kind) {
    return { mode: "timer", kind, text: text.slice(kind.length).trim() }
  }

  return { mode: "search", text: text.trim() }
}

const URL_LIKE =
  /^(https?:\/\/\S+|www\.\S+|[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?)$/i
const PATH_LIKE = /^([a-z]:[\\/]|\\\\)/i
const BARE_NAME = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i
const FILE_EXTENSIONS = new Set([
  ...["exe", "lnk", "url", "bat", "cmd", "dll", "msi", "ini", "cfg", "log"],
  ...["json", "js", "ts", "jsx", "tsx", "svelte", "css", "html", "htm"],
  ...["txt", "md", "py", "rs", "go", "java", "cs", "cpp", "c", "h"],
  ...["yaml", "yml", "toml", "xml", "csv", "zip", "rar", "gz"],
  ...["png", "jpg", "jpeg", "gif", "svg", "ico", "pdf"],
  ...["doc", "docx", "xls", "xlsx", "ppt", "pptx", "mp3", "mp4"],
])

const looksLikeFile = (text: string) => {
  const extension = text.slice(text.lastIndexOf(".") + 1).toLowerCase()

  return BARE_NAME.test(text) && FILE_EXTENSIONS.has(extension)
}

export const openTarget = (text: string): string | null => {
  if (PATH_LIKE.test(text)) {
    return text
  }

  if (/\s/.test(text) || !URL_LIKE.test(text) || looksLikeFile(text)) {
    return null
  }

  return /^https?:\/\//i.test(text) ? text : `https://${text}`
}

export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .toLowerCase()

const CHOSEONG_ONLY = /^[\u3131-\u314e]+$/
const SEPARATOR = /[\s\-_./\\(),:&]/

export const isChoseongQuery = (query: string) =>
  CHOSEONG_ONLY.test(query.replace(/\s/g, ""))

const choseongOf = (text: string) => getChoseong(text).replace(/\s/g, "")

const isBoundary = (raw: string, low: string, at: number) => {
  if (at === 0 || SEPARATOR.test(low[at - 1])) {
    return true
  }

  if (raw.length !== low.length) {
    return false
  }

  const prev = raw[at - 1]
  const here = raw[at]

  return (
    prev === prev.toLowerCase() &&
    here !== here.toLowerCase() &&
    prev !== prev.toUpperCase()
  )
}

const boundaryIndex = (raw: string, low: string, ch: string, from: number) => {
  let idx = low.indexOf(ch, from)

  while (idx >= 0 && !isBoundary(raw, low, idx)) {
    idx = low.indexOf(ch, idx + 1)
  }

  return idx
}

const align = (
  raw: string,
  low: string,
  query: string,
  wordsFirst: boolean,
) => {
  let total = 0
  let at = -1

  for (const ch of query) {
    const earliest = low.indexOf(ch, at + 1)

    if (earliest < 0) {
      return 0
    }

    const preferred = wordsFirst ? boundaryIndex(raw, low, ch, earliest) : -1
    const idx = preferred >= 0 ? preferred : earliest

    total += 10

    if (at >= 0 && idx === at + 1) {
      total += 8
    }

    if (isBoundary(raw, low, idx)) {
      total += 6
    }

    total -= Math.min(idx - at - 1, 10)
    at = idx
  }

  return total
}

// ponytail: best of two greedy passes; swap in fzf's DP if rankings feel off
const subsequence = (raw: string, low: string, query: string) =>
  Math.max(align(raw, low, query, false), align(raw, low, query, true))

const initials = (raw: string, low: string) =>
  low
    .split("")
    .filter((ch, i) => !SEPARATOR.test(ch) && isBoundary(raw, low, i))
    .join("")

const wordStart = (low: string, query: string) => {
  let at = low.indexOf(query)

  while (at >= 0) {
    if (at === 0 || SEPARATOR.test(low[at - 1])) {
      return at
    }

    at = low.indexOf(query, at + 1)
  }

  return -1
}

const lengthPenalty = (low: string) => Math.min(low.length, 50) / 10

const unmatched = (low: string, query: string) =>
  Math.min(low.length - query.length, 150)

export const score = (text: string, rawQuery: string): number => {
  const query = normalize(rawQuery).trim()

  if (!query) {
    return 0
  }

  const low = normalize(text)

  if (low === query) {
    return 1000
  }

  if (low.startsWith(query)) {
    return 900 - unmatched(low, query)
  }

  if (isChoseongQuery(query)) {
    const cho = choseongOf(text)
    const compact = query.replace(/\s/g, "")

    if (cho.startsWith(compact)) {
      return 850 - lengthPenalty(low)
    }

    if (cho.includes(compact)) {
      return 650 - lengthPenalty(low)
    }

    const partial = subsequence(cho, cho, compact)

    return partial > 0 ? 300 + partial - lengthPenalty(low) : 0
  }

  const word = wordStart(low, query)

  if (word >= 0) {
    return 900 - unmatched(low, query) - Math.min(word, 20) / 2
  }

  const acronym = initials(text, low).indexOf(query)

  if (acronym >= 0) {
    return 700 - acronym - lengthPenalty(low)
  }

  const contains = low.indexOf(query)

  if (contains >= 0) {
    return 650 - Math.min(contains, 50) - lengthPenalty(low)
  }

  const partial = subsequence(text, low, query)

  return partial > 0 ? Math.min(600, 200 + partial) - lengthPenalty(low) : 0
}

export const matchScore = (result: Result, query: string) => {
  const own = score(result.title, query)
  const extra = (result.keywords ?? []).map(k => score(k, query) * 0.9)

  return Math.max(own, ...extra)
}

export const rank = (
  items: Result[],
  query: string,
  boost: (id: string) => number,
): Result[] =>
  items
    .map(item => ({ ...item, score: matchScore(item, query) }))
    .filter(item => item.score > 0)
    .map(item => ({ ...item, score: item.score + boost(item.id) }))

const KIND_ORDER: ResultKind[] = [
  "unit",
  "calc",
  "emoji",
  "timer",
  "todo",
  "run",
  "clip",
  "app",
  "window",
  "setting",
  "command",
  "web",
]

const topScore = (group: ResultGroup) => group.items[0]?.score ?? 0

export const groupResults = (
  items: Result[],
  limit: (kind: ResultKind) => number,
): ResultGroup[] => {
  const byKind = new Map<ResultKind, Result[]>()

  for (const item of items) {
    const bucket = byKind.get(item.kind) ?? []

    bucket.push(item)
    byKind.set(item.kind, bucket)
  }

  const groups = KIND_ORDER.flatMap(kind => {
    const bucket = byKind.get(kind)

    if (!bucket?.length) {
      return []
    }

    const sorted = [...bucket]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit(kind))

    return [{ kind, label: groupLabels[kind], start: 0, items: sorted }]
  })

  groups.sort((a, b) => {
    if (a.kind === "web" || b.kind === "web") {
      return a.kind === "web" ? 1 : -1
    }

    return (
      topScore(b) - topScore(a) ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
    )
  })

  let start = 0

  for (const group of groups) {
    group.start = start
    start += group.items.length
  }

  return groups
}
