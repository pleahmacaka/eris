import type { EditorView } from "@codemirror/view"

export const editors = new Map<string, EditorView>()

export const revealLine = (tabId: string, line: number) => {
  const view = editors.get(tabId)

  if (!view) {
    return
  }

  const target = view.state.doc.line(Math.min(line, view.state.doc.lines))

  view.dispatch({
    selection: { anchor: target.from },
    scrollIntoView: true,
  })
  view.focus()
}
