<script lang="ts">
  import { t } from "svelte-i18n"
  import {
    readText,
    writeText,
  } from "@tauri-apps/plugin-clipboard-manager"
  import {
    closeContextMenu,
    contextMenu,
    openContextMenu,
  } from "../../store/context.svelte"
  import type { MenuItem } from "../../menus/menu"
  import ContextMenu from "./ContextMenu.svelte"

  let { dense = false }: { dense?: boolean } = $props()

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
        label: $t("menu.cut"),
        icon: "lucide:scissors",
        disabled: !selected,
        action: async () => {
          await writeText(selected)
          replaceSelection(field, "")
        },
      },
      {
        label: $t("menu.copy"),
        icon: "lucide:copy",
        disabled: !selected,
        action: () => writeText(selected),
      },
      {
        label: $t("menu.paste"),
        icon: "lucide:clipboard",
        action: async () => {
          const text = await readText()

          field.focus()
          replaceSelection(field, text ?? "")
        },
      },
      "separator",
      {
        label: $t("menu.selectAll"),
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

  const external = $derived(
    contextMenu.request !== null && contextMenu.presenter?.ready === true,
  )

  const FORWARDED = ["ArrowUp", "ArrowDown", "Enter"]

  $effect(() => {
    open = contextMenu.request !== null
  })

  $effect(() => {
    const { request, presenter } = contextMenu

    if (request && external) {
      presenter?.show(request, dense)
    } else {
      presenter?.hide()
    }
  })

  const onkeydown = (e: KeyboardEvent) => {
    if (!external) {
      return
    }

    if (e.key === "Escape") {
      e.preventDefault()
      closeContextMenu()
    } else if (FORWARDED.includes(e.key)) {
      e.preventDefault()
      contextMenu.presenter?.key(e.key)
    }
  }

  const onmousedown = (e: MouseEvent) => {
    const anchor = contextMenu.request?.anchor

    if (external && !anchor?.contains(e.target as Node)) {
      closeContextMenu()
    }
  }

  const dismiss = () => {
    if (external) {
      closeContextMenu()
    }
  }

  $effect(() => {
    window.addEventListener("eris-close-menus", dismiss)

    return () => window.removeEventListener("eris-close-menus", dismiss)
  })
</script>

<svelte:document {oncontextmenu} />

<svelte:window {onkeydown} {onmousedown} />

{#if contextMenu.request && !external}
  <ContextMenu
    bind:open
    items={contextMenu.request.items}
    x={contextMenu.request.x}
    y={contextMenu.request.y}
    placement={contextMenu.request.placement ?? "down"}
    anchor={contextMenu.request.anchor}
    {dense}
    onclose={closeContextMenu}
  />
{/if}
