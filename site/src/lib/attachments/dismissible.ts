import type { Attachment } from "svelte/attachments"

export const dismissible: Attachment<HTMLElement> = node => {
  const close = () => {
    if (node.matches(":popover-open")) {
      node.hidePopover()
    }
  }

  const onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget

    if (!(next instanceof Node) || !node.contains(next)) {
      close()
    }
  }

  node.addEventListener("focusout", onFocusOut)
  window.addEventListener("blur", close)

  return () => {
    node.removeEventListener("focusout", onFocusOut)
    window.removeEventListener("blur", close)
  }
}
