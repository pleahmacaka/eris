import { copyText, pasteText } from "./clipboard"
import type { MenuItem } from "./menu.svelte"

type Field = HTMLInputElement | HTMLTextAreaElement

const isField = (node: Element | null): node is Field =>
  node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement

const replaceSelection = (field: Field, text: string) => {
  field.focus()
  field.setRangeText(
    text,
    field.selectionStart ?? field.value.length,
    field.selectionEnd ?? field.value.length,
    "end",
  )
  field.dispatchEvent(new Event("input", { bubbles: true }))
}

export const fieldMenu = (target: EventTarget | null): MenuItem[] | null => {
  const field = (target as Element | null)?.closest?.("input, textarea") ?? null

  if (!isField(field) || (field.readOnly && field.type !== "text")) {
    return null
  }

  const selected = () =>
    field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0)

  const hasSelection = selected() !== ""

  return [
    {
      label: "잘라내기",
      icon: "lucide:scissors",
      keys: "Ctrl X",
      disabled: !hasSelection || field.readOnly,
      run: async () => {
        await copyText(selected())
        replaceSelection(field, "")
      },
    },
    {
      label: "복사",
      icon: "lucide:copy",
      keys: "Ctrl C",
      disabled: !hasSelection,
      run: () => copyText(selected()),
    },
    {
      label: "붙여넣기",
      icon: "lucide:clipboard-paste",
      keys: "Ctrl V",
      disabled: field.readOnly,
      run: async () => replaceSelection(field, await pasteText()),
    },
    "separator",
    {
      label: "모두 선택",
      icon: "lucide:text-select",
      keys: "Ctrl A",
      run: () => {
        field.focus()
        field.select()
      },
    },
  ]
}
