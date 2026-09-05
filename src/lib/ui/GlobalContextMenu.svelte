<script lang="ts">
  import {
    readText,
    writeText,
  } from "@tauri-apps/plugin-clipboard-manager"
  import {
    closeContextMenu,
    contextMenu,
    openContextMenu,
  } from "./context.svelte"
  import type { MenuItem } from "./menu"
  import ContextMenu from "./ContextMenu.svelte"

  const editable = (el: Element | null): HTMLInputElement | HTMLTextAreaElement | null => {
    if (el instanceof HTMLTextAreaElement) {
      return el
    }

    if (el instanceof HTMLInputElement && !el.readOnly && el.type !== "range") {
      return el
    }

    return null
  }

  const selectionOf = (field: HTMLInputElement | HTMLTextAreaElement) =>
    field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0)

  const replaceSelection = (
    field: HTMLInputElement | HTMLTextAreaElement,
    text: string,
  ) => {
    const start = field.selectionStart ?? field.value.length
    const end = field.selectionEnd ?? field.value.length

    field.setRangeText(text, start, end, "end")
    field.dispatchEvent(new Event("input", { bubbles: true }))
  }

  const fieldMenu = (
    field: HTMLInputElement | HTMLTextAreaElement,
  ): MenuItem[] => {
    const selected = selectionOf(field)

    return [
      {
        label: "Cut",
        icon: "lucide:scissors",
        disabled: !selected,
        action: async () => {
          await writeText(selected)
          replaceSelection(field, "")
        },
      },
      {
        label: "Copy",
        icon: "lucide:copy",
        disabled: !selected,
        action: () => writeText(selected),
      },
      {
        label: "Paste",
        icon: "lucide:clipboard",
        action: async () => {
          const text = await readText()

          field.focus()
          replaceSelection(field, text ?? "")
        },
      },
      "separator",
      {
        label: "Select all",
        icon: "lucide:text-cursor-input",
        disabled: !field.value,
        action: () => {
          field.focus()
          field.select()
        },
      },
    ]
  }

  const oncontextmenu = (e: MouseEvent) => {
    e.preventDefault()

    if (e.defaultPrevented && contextMenu.request) {
      return
    }

    const field = editable(e.target as Element)

    if (!field) {
      return closeContextMenu()
    }

    field.focus()

    openContextMenu({
      items: fieldMenu(field),
      x: e.clientX,
      y: e.clientY,
      placement: "down",
    })
  }

  let open = $state(false)

  $effect(() => {
    open = contextMenu.request !== null
  })
</script>

<svelte:document {oncontextmenu} />

{#if contextMenu.request}
  <ContextMenu
    bind:open
    items={contextMenu.request.items}
    x={contextMenu.request.x}
    y={contextMenu.request.y}
    placement={contextMenu.request.placement ?? "down"}
    onclose={closeContextMenu}
  />
{/if}
