import {
  autocompletion,
  type CompletionSource,
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
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { EditorState } from "@codemirror/state"
import {
  drawSelection,
  EditorView,
  keymap,
  placeholder,
} from "@codemirror/view"
import { tags } from "@lezer/highlight"
import { type BlockLabels, formatKeymap, slashCommands } from "./blocks"
import { livePreview } from "./live"

export type { CompletionSource } from "@codemirror/autocomplete"
export type { EditorView } from "@codemirror/view"
export type { BlockLabels } from "./blocks"

export type LiveEditorOptions = {
  parent: HTMLElement
  doc: string
  placeholder: string
  blocks: BlockLabels
  completions?: CompletionSource[]
  onChange: (text: string) => void
  onBlur?: () => void
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
])

const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "inherit" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.6",
    overflow: "visible",
  },
  ".cm-content": { padding: "0", caretColor: "var(--color-primary)" },
  ".cm-line": { padding: "0" },
  ".cm-cursor": { borderLeftColor: "var(--color-primary)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor:
      "color-mix(in oklch, var(--color-primary) 28%, transparent)",
  },
  ".cm-h1": { fontSize: "1.35em" },
  ".cm-h2": { fontSize: "1.2em" },
  ".cm-h3": { fontSize: "1.08em" },
  ".cm-quote": {
    borderLeft: "0.1875rem solid var(--color-primary)",
    paddingLeft: "0.625rem",
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
  ".cm-placeholder": {
    color: "color-mix(in oklch, currentColor 45%, transparent)",
  },
  ".cm-tooltip": {
    border:
      "0.0625rem solid color-mix(in oklch, currentColor 12%, transparent)",
    backgroundColor: "var(--color-base-100)",
    borderRadius: "var(--radius-field)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete ul li": { padding: "0.25rem 0.5rem" },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": { fontFamily: "inherit" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor:
      "color-mix(in oklch, var(--color-primary) 25%, transparent)",
    color: "inherit",
  },
  ".cm-completionDetail": {
    marginLeft: "0.75rem",
    opacity: "0.5",
    fontStyle: "normal",
  },
})

const toggleTask = (view: EditorView, target: HTMLElement) => {
  const pos = view.posAtDOM(target)
  const marker = view.state.sliceDoc(pos, pos + 3)

  if (marker !== "[ ]" && marker !== "[x]" && marker !== "[X]") {
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

export const createLiveEditor = (options: LiveEditorOptions) =>
  new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        history(),
        drawSelection(),
        closeBrackets(),
        autocompletion({
          override: [
            slashCommands(options.blocks),
            ...(options.completions ?? []),
          ],
          icons: false,
        }),
        formatKeymap,
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(highlight),
        livePreview,
        EditorView.lineWrapping,
        placeholder(options.placeholder),
        theme,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            options.onChange(update.state.doc.toString())
          }

          if (update.focusChanged && !update.view.hasFocus) {
            options.onBlur?.()
          }
        }),
        EditorView.domEventHandlers({
          mousedown: (event, view) => {
            const target = event.target as HTMLElement

            if (!target.classList.contains("cm-task")) {
              return false
            }

            event.preventDefault()

            return toggleTask(view, target)
          },
        }),
      ],
    }),
  })

export const placeCaretAtEnd = (view: EditorView) => {
  view.focus()
  view.dispatch({ selection: { anchor: view.state.doc.length } })
}
