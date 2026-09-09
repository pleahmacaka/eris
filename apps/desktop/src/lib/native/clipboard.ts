import { invoke } from "@tauri-apps/api/core"

export type ClipEntry = {
  id: string
  text: string
  at: number
  pinned: boolean
}

export const clipboardHistory = () => invoke<ClipEntry[]>("clipboard_history")

export const clipboardCopy = (id: string) =>
  invoke<void>("clipboard_copy", { id })

export const clipboardPaste = (id: string) =>
  invoke<void>("clipboard_paste", { id })

export const clipboardRemove = (id: string) =>
  invoke<void>("clipboard_remove", { id })

export const clipboardPin = (id: string, pinned: boolean) =>
  invoke<void>("clipboard_pin", { id, pinned })

export const clipboardClear = () => invoke<void>("clipboard_clear")
