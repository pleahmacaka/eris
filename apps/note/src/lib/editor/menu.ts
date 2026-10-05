import type { EditorView } from "@codemirror/view"
import { copyText, pasteText } from "../menu/clipboard"
import type { MenuItem } from "../menu/menu.svelte"

const selection = (view: EditorView) => {
  const { from, to } = view.state.selection.main

  return { from, to, text: view.state.sliceDoc(from, to) }
}

const replace = (view: EditorView, text: string, caret = text.length) => {
  const { from, to } = selection(view)

  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + caret },
  })
  view.focus()
}

const wrap = (view: EditorView, mark: string) => {
  const { text } = selection(view)

  replace(view, `${mark}${text}${mark}`, text ? undefined : mark.length)
}

export const editorMenu = (
  view: EditorView,
  extra: MenuItem[] = [],
): MenuItem[] => {
  const { text } = selection(view)

  return [
    {
      label: "잘라내기",
      icon: "lucide:scissors",
      keys: "Ctrl X",
      disabled: text === "",
      run: async () => {
        await copyText(text)
        replace(view, "")
      },
    },
    {
      label: "복사",
      icon: "lucide:copy",
      keys: "Ctrl C",
      disabled: text === "",
      run: () => copyText(text),
    },
    {
      label: "붙여넣기",
      icon: "lucide:clipboard-paste",
      keys: "Ctrl V",
      run: async () => replace(view, await pasteText()),
    },
    {
      label: "모두 선택",
      icon: "lucide:text-select",
      keys: "Ctrl A",
      run: () => {
        view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
        view.focus()
      },
    },
    "separator",
    {
      label: "노트 링크",
      icon: "lucide:link-2",
      run: () => replace(view, `[[${text}]]`, text ? undefined : 2),
    },
    { label: "굵게", icon: "lucide:bold", run: () => wrap(view, "**") },
    { label: "기울임", icon: "lucide:italic", run: () => wrap(view, "*") },
    { label: "코드", icon: "lucide:code", run: () => wrap(view, "`") },
    ...(extra.length > 0 ? (["separator", ...extra] as MenuItem[]) : []),
  ]
}
