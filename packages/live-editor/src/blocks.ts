import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete"
import type { EditorState } from "@codemirror/state"
import { type EditorView, type KeyBinding, keymap } from "@codemirror/view"

export type BlockId =
  | "text"
  | "h1"
  | "h2"
  | "h3"
  | "todo"
  | "bullet"
  | "number"
  | "quote"
  | "code"
  | "divider"
  | "date"

export type BlockLabels = Record<BlockId, string>

type Block = {
  id: BlockId
  hint: string
  aliases: string[]
  prefix?: string
  insert?: (today: string) => { text: string; caret: number }
}

const BLOCKS: Block[] = [
  { id: "text", hint: "", aliases: ["text", "p"], prefix: "" },
  { id: "h1", hint: "#", aliases: ["h1", "heading"], prefix: "# " },
  { id: "h2", hint: "##", aliases: ["h2", "heading"], prefix: "## " },
  { id: "h3", hint: "###", aliases: ["h3", "heading"], prefix: "### " },
  {
    id: "todo",
    hint: "[ ]",
    aliases: ["todo", "task", "check"],
    prefix: "- [ ] ",
  },
  { id: "bullet", hint: "-", aliases: ["bullet", "list", "ul"], prefix: "- " },
  { id: "number", hint: "1.", aliases: ["number", "ol"], prefix: "1. " },
  { id: "quote", hint: ">", aliases: ["quote"], prefix: "> " },
  {
    id: "code",
    hint: "```",
    aliases: ["code"],
    insert: () => ({ text: "```\n\n```", caret: 4 }),
  },
  {
    id: "divider",
    hint: "---",
    aliases: ["divider", "hr", "line"],
    insert: () => ({ text: "---\n", caret: 4 }),
  },
  {
    id: "date",
    hint: "",
    aliases: ["date", "today"],
    insert: today => ({ text: today, caret: today.length }),
  },
]

export const KOREAN_BLOCKS: BlockLabels = {
  text: "본문",
  h1: "제목 1",
  h2: "제목 2",
  h3: "제목 3",
  todo: "할 일",
  bullet: "글머리 기호",
  number: "번호 목록",
  quote: "인용",
  code: "코드 블록",
  divider: "구분선",
  date: "오늘 날짜",
}

const MARKUP = /^(#{1,6} |> |[-*+] \[[ xX]\] |[-*+] |\d+[.)] )/

const pad = (n: number) => String(n).padStart(2, "0")

const today = () => {
  const d = new Date()

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const markupOf = (text: string) => MARKUP.exec(text)?.[0] ?? ""

const applyBlock = (
  view: EditorView,
  block: Block,
  from: number,
  to: number,
) => {
  const line = view.state.doc.lineAt(from)

  if (block.insert) {
    const { text, caret } = block.insert(today())

    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + caret },
    })

    return
  }

  const prefix = block.prefix ?? ""
  const old = markupOf(line.text)
  const shift = prefix.length - old.length

  view.dispatch({
    changes: [
      { from: line.from, to: line.from + old.length, insert: prefix },
      { from, to },
    ],
    selection: { anchor: from + shift },
  })
}

export const slashCommands =
  (labels: BlockLabels) =>
  (context: CompletionContext): CompletionResult | null => {
    const typed = context.matchBefore(/\/[^\s/]*/)

    if (!typed) {
      return null
    }

    const line = context.state.doc.lineAt(typed.from)
    const before = context.state.sliceDoc(typed.from - 1, typed.from)

    if (typed.from > line.from && before !== " ") {
      return null
    }

    const query = typed.text.slice(1).toLowerCase()

    const options: Completion[] = BLOCKS.filter(
      b =>
        labels[b.id].toLowerCase().includes(query) ||
        b.aliases.some(a => a.startsWith(query)),
    ).map(b => ({
      label: labels[b.id],
      detail: b.hint,
      apply: (view, _completion, from, to) => applyBlock(view, b, from, to),
    }))

    return options.length > 0
      ? { from: typed.from, options, filter: false }
      : null
  }

const selected = (state: EditorState) => {
  const { from, to } = state.selection.main

  return { from, to, text: state.sliceDoc(from, to) }
}

export const wrapWith = (mark: string) => (view: EditorView) => {
  const { from, to, text } = selected(view.state)
  const outer = view.state.sliceDoc(from - mark.length, to + mark.length)
  const wrapped =
    outer.startsWith(mark) &&
    outer.endsWith(mark) &&
    outer.length >= mark.length * 2

  if (wrapped) {
    view.dispatch({
      changes: [
        { from: from - mark.length, to: from },
        { from: to, to: to + mark.length },
      ],
      selection: { anchor: from - mark.length, head: to - mark.length },
    })

    return true
  }

  view.dispatch({
    changes: { from, to, insert: `${mark}${text}${mark}` },
    selection: { anchor: from + mark.length, head: to + mark.length },
  })

  return true
}

const insertLink = (view: EditorView) => {
  const { from, to, text } = selected(view.state)
  const insert = `[${text}]()`

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length - 1 },
  })

  return true
}

export const toggleTaskLine = (view: EditorView) => {
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  const indent = line.text.length - line.text.trimStart().length
  const body = line.text.slice(indent)
  const start = line.from + indent

  const change = body.startsWith("- [ ] ")
    ? { from: start + 3, to: start + 4, insert: "x" }
    : /^[-*+] \[[xX]\] /.test(body)
      ? { from: start + 3, to: start + 4, insert: " " }
      : { from: start, to: start + markupOf(body).length, insert: "- [ ] " }

  view.dispatch({ changes: change })

  return true
}

const FORMAT_KEYS: KeyBinding[] = [
  { key: "Mod-b", run: wrapWith("**") },
  { key: "Mod-i", run: wrapWith("*") },
  { key: "Mod-e", run: wrapWith("`") },
  { key: "Mod-Shift-x", run: wrapWith("~~") },
  { key: "Mod-k", run: insertLink },
  { key: "Mod-Enter", run: toggleTaskLine },
]

export const formatKeymap = keymap.of(FORMAT_KEYS)
