export type Choice = { key: string; label: string }

export type Prompt = {
  question: string
  detail: string[]
  choices: Choice[]
}

export type Screen = {
  busy: boolean
  prompt: Prompt | null
  overlay: boolean
}

const FRAME = "│┃╭╮╰╯─━┌┐└┘"
const POINTER = "❯›>"
const DETAIL_LIMIT = 4
const BUSY_MARK = "esc to interrupt"
const RULE = "─━"
const INPUT_MARK = ">❯"

const isRule = (line: string) =>
  line.length > 0 && [...line].every(ch => RULE.includes(ch))

const hasInputBox = (raw: string[]) =>
  raw.some(
    (line, at) =>
      at > 0 &&
      INPUT_MARK.includes(line.trim()[0] ?? "") &&
      isRule(raw[at - 1].trim()),
  )

const unframe = (line: string) => {
  let text = line.trim()

  while (text && FRAME.includes(text[0])) {
    text = text.slice(1)
  }

  while (text && FRAME.includes(text.at(-1) ?? "")) {
    text = text.slice(0, -1)
  }

  return text.trim()
}

const choiceOf = (line: string) => {
  const pointed = POINTER.includes(line[0] ?? "")
  const text = pointed ? line.slice(1).trim() : line
  const dot = text.indexOf(". ")
  const key = dot > 0 ? text.slice(0, dot) : ""

  if (!key || !Number.isInteger(Number(key))) {
    return null
  }

  return { pointed, choice: { key, label: text.slice(dot + 2).trim() } }
}

export const parseScreen = (text: string): Screen => {
  const raw = text.split("\n")
  const lines = raw.map(unframe)
  const busy = text.toLowerCase().includes(BUSY_MARK)
  const overlay = !hasInputBox(raw)
  const found = lines.map(choiceOf)
  const last = found.findLastIndex(Boolean)

  if (last === -1) {
    return { busy, prompt: null, overlay }
  }

  let first = last

  while (first > 0 && found[first - 1]) {
    first -= 1
  }

  const group = found.slice(first, last + 1).filter(item => item !== null)

  if (group.length < 2 || !group.some(item => item.pointed)) {
    return { busy, prompt: null, overlay }
  }

  const above = lines.slice(0, first)
  const at = above.findLastIndex(line => line.length > 0)
  const question = at === -1 ? "" : above[at]
  const detail: string[] = []

  let y = at - 1

  while (y >= 0 && !above[y]) {
    y -= 1
  }

  while (y >= 0 && above[y] && detail.length < DETAIL_LIMIT) {
    detail.unshift(above[y])
    y -= 1
  }

  return {
    busy,
    prompt: { question, detail, choices: group.map(item => item.choice) },
    overlay: false,
  }
}
