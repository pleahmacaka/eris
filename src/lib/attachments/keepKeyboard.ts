import type { Attachment } from "svelte/attachments"
import { keymapStore } from "#lib/store/keymap.svelte.js"

export const keepKeyboard = (): Attachment<HTMLElement> => node => {
  const focus = () => node.focus()
  const modal = document.querySelector("dialog[open]")

  if (matchMedia("(pointer: fine)").matches) {
    focus()
    // an open modal dialog keeps the page inert, so focus only lands once it closes
    modal?.addEventListener("close", focus, { once: true })
  }

  const release = keymapStore.handle({ focusMessage: focus })

  return () => {
    release()
    modal?.removeEventListener("close", focus)
  }
}
