import {
  autocompletion,
  type Completion,
  type CompletionContext,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete"
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language"
import { languages } from "@codemirror/language-data"
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search"
import { EditorState } from "@codemirror/state"
import {
  drawSelection,
  dropCursor,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view"
import { tags } from "@lezer/highlight"
import { linkText } from "../vault/links"
import { dirname, isNote } from "../vault/paths"
import { livePreview } from "./live"

export type EditorOptions = {
  parent: HTMLElement
  doc: string
  paths: () => readonly string[]
  onChange: (text: string) => void
  onLink: (target: string, newTab: boolean) => void
}

const highlight = HighlightStyle.define([
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.heading, fontWeight: "700" },
  { tag: tags.link, color: "var(--color-primary)" },
  {
    tag: tags.url,
    color: "color-mix(in oklch, currentColor 55%, transparent)",
  },
  {
    tag: tags.monospace,
    backgroundColor: "color-mix(in oklch, currentColor 8%, transparent)",
  },
  {
    tag: tags.quote,
    color: "color-mix(in oklch, currentColor 75%, transparent)",
  },
  {
    tag: [tags.processingInstruction, tags.meta, tags.contentSeparator],
    color: "color-mix(in oklch, currentColor 40%, transparent)",
  },
  { tag: tags.keyword, color: "var(--color-primary)" },
  { tag: tags.string, color: "var(--color-accent)" },
  { tag: [tags.number, tags.bool], color: "var(--color-success)" },
  {
    tag: tags.comment,
    color: "color-mix(in oklch, currentColor 50%, transparent)",
  },
])

const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.75" },
  ".cm-content": {
    maxWidth: "46rem",
    margin: "0 auto",
    padding: "1.5rem 1.5rem 40vh",
    caretColor: "var(--color-primary)",
  },
  ".cm-cursor": { borderLeftColor: "var(--color-primary)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor:
      "color-mix(in oklch, var(--color-primary) 28%, transparent)",
  },
  ".cm-h1": { fontSize: "1.9em", lineHeight: "1.4" },
  ".cm-h2": { fontSize: "1.55em", lineHeight: "1.4" },
  ".cm-h3": { fontSize: "1.3em" },
  ".cm-h4": { fontSize: "1.12em" },
  ".cm-quote": {
    borderLeft: "0.1875rem solid var(--color-primary)",
    paddingLeft: "0.75rem",
  },
  ".cm-bullet": { color: "var(--color-primary)", fontWeight: "700" },
  ".cm-task": { verticalAlign: "middle", marginRight: "0.25rem" },
  ".cm-rule": {
    display: "inline-block",
    width: "100%",
    verticalAlign: "middle",
    borderTop:
      "0.0625rem solid color-mix(in oklch, currentColor 20%, transparent)",
  },
  ".cm-wikilink": {
    color: "var(--color-primary)",
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationColor:
      "color-mix(in oklch, var(--color-primary) 40%, transparent)",
    textUnderlineOffset: "0.2em",
  },
  ".cm-panels": {
    backgroundColor: "var(--color-base-100)",
    color: "inherit",
  },
  ".cm-panels-top": {
    borderBottom:
      "0.0625rem solid color-mix(in oklch, currentColor 10%, transparent)",
  },
  ".cm-search": { fontSize: "0.8125rem", padding: "0.375rem 0.75rem" },
  ".cm-search input, .cm-search button": {
    fontFamily: "inherit",
    fontSize: "inherit",
    border:
      "0.0625rem solid color-mix(in oklch, currentColor 15%, transparent)",
    background: "var(--color-base-200)",
    color: "inherit",
    borderRadius: "0",
  },
  ".cm-searchMatch": {
    backgroundColor:
      "color-mix(in oklch, var(--color-warning) 30%, transparent)",
  },
  ".cm-searchMatch-selected": {
    backgroundColor:
      "color-mix(in oklch, var(--color-primary) 40%, transparent)",
  },
  ".cm-selectionMatch": {
    backgroundColor:
      "color-mix(in oklch, var(--color-primary) 14%, transparent)",
  },
  ".cm-placeholder": {
    color: "color-mix(in oklch, currentColor 35%, transparent)",
  },
  ".cm-tooltip": {
    border:
      "0.0625rem solid color-mix(in oklch, currentColor 12%, transparent)",
    backgroundColor: "var(--color-base-100)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor:
      "color-mix(in oklch, var(--color-primary) 25%, transparent)",
    color: "inherit",
  },
})

const wikilinkCompletion =
  (paths: () => readonly string[]) => (context: CompletionContext) => {
    const before = context.matchBefore(/\[\[[^\]\n|]*/)

    if (!before) {
      return null
    }

    const all = paths()

    const options: Completion[] = all.filter(isNote).map(path => {
      const label = linkText(path, all)

      return {
        label,
        detail: dirname(path) || undefined,
        apply: (view, _completion, from, to) => {
          const closed = view.state.sliceDoc(to, to + 2) === "]]"
          const insert = closed ? label : `${label}]]`

          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + insert.length + (closed ? 2 : 0) },
          })
        },
      }
    })

    return { from: before.from + 2, options, validFor: /^[^\]\n|]*$/ }
  }

const editingLine = (view: EditorView, pos: number) => {
  const line = view.state.doc.lineAt(pos).number

  return (
    view.hasFocus &&
    view.state.selection.ranges.some(
      r =>
        view.state.doc.lineAt(r.from).number <= line &&
        line <= view.state.doc.lineAt(r.to).number,
    )
  )
}

const toggleTask = (view: EditorView, target: HTMLElement) => {
  const pos = view.posAtDOM(target)
  const marker = view.state.sliceDoc(pos, pos + 3)

  if (!/^\[[ xX]\]$/.test(marker)) {
    return false
  }

  view.dispatch({
    changes: {
      from: pos + 1,
      to: pos + 2,
      insert: marker[1] === " " ? "x" : " ",
    },
  })

  return true
}

export const createEditor = (options: EditorOptions) =>
  new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({
          override: [wikilinkCompletion(options.paths)],
          icons: false,
        }),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        search({ top: true }),
        highlightSelectionMatches(),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(highlight),
        livePreview,
        EditorView.lineWrapping,
        placeholder("내용을 입력하세요."),
        theme,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            options.onChange(update.state.doc.toString())
          }
        }),
        EditorView.domEventHandlers({
          mousedown: (event, view) => {
            const target = event.target as HTMLElement

            if (target.classList.contains("cm-task")) {
              event.preventDefault()

              return toggleTask(view, target)
            }

            const link = target.closest<HTMLElement>(".cm-wikilink")

            if (!link?.dataset.target) {
              return false
            }

            const modified = event.ctrlKey || event.metaKey

            if (!modified && editingLine(view, view.posAtDOM(link))) {
              return false
            }

            event.preventDefault()
            options.onLink(link.dataset.target, modified)

            return true
          },
        }),
      ],
    }),
  })

export const replaceDoc = (view: EditorView, text: string) => {
  if (view.state.doc.toString() === text) {
    return
  }

  const anchor = Math.min(view.state.selection.main.anchor, text.length)

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor },
  })
}
