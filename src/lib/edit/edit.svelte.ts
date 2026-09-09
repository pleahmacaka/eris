import { listen } from "@tauri-apps/api/event"
import * as native from "$lib/native"

export const editing = $state({ on: false, open: null as string | null })

export const startEdit = () => native.editMode(true).catch(() => undefined)

export const stopEdit = () => native.editMode(false).catch(() => undefined)

export const watchEdit = () => {
  const stop = listen<boolean>("edit-mode", e => {
    editing.on = e.payload
    editing.open = null
  })

  const onkeydown = (e: KeyboardEvent) => {
    if (!editing.on || e.key !== "Escape") {
      return
    }

    e.preventDefault()
    e.stopImmediatePropagation()

    if (editing.open) {
      editing.open = null

      return
    }

    stopEdit()
  }

  window.addEventListener("keydown", onkeydown, true)

  return () => {
    stop.then(off => off())
    window.removeEventListener("keydown", onkeydown, true)
  }
}
