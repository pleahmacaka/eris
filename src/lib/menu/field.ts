export type TextField = HTMLInputElement | HTMLTextAreaElement

const TEXT_INPUT_TYPES = ["text", "search", "url", "password", "tel"]

export const isTextField = (target: EventTarget | null): target is TextField =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && TEXT_INPUT_TYPES.includes(target.type))

export const selectedText = (field: TextField) =>
  field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0)

export const replaceSelection = (field: TextField, text: string) => {
  field.setRangeText(
    text,
    field.selectionStart ?? 0,
    field.selectionEnd ?? 0,
    "end",
  )
  field.dispatchEvent(new Event("input", { bubbles: true }))
  field.focus()
}
