<script lang="ts">
  import Icon from "@iconify/svelte"
  import * as native from "$lib/native"
  import type { DockEdge } from "$lib/settings"
  import ContextMenu from "$lib/ui/ContextMenu.svelte"
  import { closePreview, dismissPreview, openPreview } from "./preview.svelte"
  import type { MenuItem } from "$lib/ui/menu"
  import {
    type DockGroup,
    iconFor,
    toggleDockHidden,
    toggleDockPin,
  } from "./dock.svelte"

  type Props = {
    group: DockGroup
    size: number
    edge: DockEdge
    mac: boolean
    foreground: number | undefined
    alignEnd: boolean
    hiddenHere?: boolean
    magnify?: number
    dragging?: boolean
    dropBefore?: boolean
    dropAfter?: boolean
    ondragstart?: () => void
    ondragover?: (before: boolean) => void
    ondrop?: () => void
    ondragend?: () => void
    onmenu: (height: number) => void
  }

  let {
    group,
    size,
    edge,
    mac,
    foreground,
    alignEnd,
    hiddenHere = false,
    magnify = 1,
    dragging = false,
    dropBefore = false,
    dropAfter = false,
    ondragstart,
    ondragover,
    ondrop,
    ondragend,
    onmenu,
  }: Props = $props()

  const dragStart = (e: DragEvent) => {
    e.dataTransfer?.setData("text/plain", group.path)

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"
    }

    dismissPreview()
    ondragstart?.()
  }

  const dragOver = (e: DragEvent) => {
    e.preventDefault()

    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()

    ondragover?.(e.clientX < box.left + box.width / 2)
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()
    ondrop?.()
  }

  const MENU_ROW = 40
  const MENU_PAD = 40
  const MENU_MAX_ROWS = 9

  let open = $state(false)
  let root = $state<HTMLElement>()
  let icon = $state<string | null>(null)

  $effect(() => {
    iconFor(group.path).then(value => {
      icon = value
    })
  })

  const running = $derived(group.windows.length > 0)

  const active = $derived(
    foreground !== undefined && group.windows.some(w => w.hwnd === foreground),
  )

  const menuHeight = $derived(
    MENU_PAD +
      MENU_ROW *
        Math.min(MENU_MAX_ROWS, group.windows.length + (running ? 4 : 3)),
  )

  const launch = () => native.launchApp(group.path).catch(() => undefined)

  const activate = () => {
    const [first] = group.windows

    if (!first) {
      return launch()
    }

    dismissPreview()

    if (active) {
      const current = group.windows.find(w => w.hwnd === foreground) ?? first

      return native.minimizeWindow(current.hwnd).catch(() => undefined)
    }

    return native.activateWindow(first.hwnd).catch(() => undefined)
  }

  const closeAll = async () => {
    for (const w of group.windows) {
      await native.closeWindow(w.hwnd).catch(() => undefined)
    }
  }

  const onmouseenter = () => {
    const box = root?.getBoundingClientRect()

    if (!running || open || !box) {
      return
    }

    openPreview(
      group.windows.map(w => w.hwnd),
      box.left + box.width / 2,
    )
  }

  $effect(() => dismissPreview)

  const setOpen = (next: boolean) => {
    if (open === next) {
      return
    }

    open = next
    onmenu(next ? menuHeight : 0)
  }

  const onauxclick = (e: MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      launch()
    }
  }

  const oncontextmenu = (e: MouseEvent) => {
    e.preventDefault()
    dismissPreview()
    setOpen(true)
  }

  const menuItems = $derived.by((): MenuItem[] => {
    const windows: MenuItem[] = group.windows
      .slice(0, MENU_MAX_ROWS - 4)
      .map(w => ({
        label: w.title,
        icon:
          w.hwnd === foreground ? "lucide:square-dot" : "lucide:app-window",
        action: () => native.activateWindow(w.hwnd),
      }))

    const pin: MenuItem =
      group.pinned === "windows"
        ? {
            label: hiddenHere ? "Show in dock" : "Hide from dock",
            icon: hiddenHere ? "lucide:eye" : "lucide:eye-off",
            hint: "Windows pin",
            action: () => toggleDockHidden(group.path),
          }
        : {
            label: group.pinned ? "Unpin from dock" : "Pin to dock",
            icon: group.pinned ? "lucide:pin-off" : "lucide:pin",
            action: () => toggleDockPin(group.path),
          }

    return [
      ...windows,
      ...(running ? (["separator"] as MenuItem[]) : []),
      {
        label: "Open new window",
        icon: "lucide:plus",
        action: launch,
      },
      ...(running
        ? ([
            {
              label: "Close all",
              icon: "lucide:x",
              action: closeAll,
            },
          ] as MenuItem[])
        : []),
      {
        label: "Open file location",
        icon: "lucide:folder-open",
        action: () => native.openLocation(group.path),
      },
      pin,
    ]
  })
</script>

<svelte:window onblur={() => setOpen(false)} />

<div
  bind:this={root}
  role="listitem"
  class={["relative transition-opacity duration-150", dragging && "opacity-30"]}
  ondragover={dragOver}
  ondrop={drop}
  {ondragend}
>
  {#if dropBefore}
    <span
      class="pointer-events-none absolute inset-y-1 -left-1 w-0.5 rounded-full bg-primary"
    ></span>
  {/if}

  {#if dropAfter}
    <span
      class="pointer-events-none absolute inset-y-1 -right-1 w-0.5 rounded-full bg-primary"
    ></span>
  {/if}

  <button
    draggable="true"
    ondragstart={dragStart}
    class={[
      "btn btn-ghost btn-square relative origin-bottom will-change-transform active:scale-90",
      mac ? "transition-transform duration-100" : "transition-transform duration-150",
      active && "bg-base-content/10",
    ]}
    style:--size="{size + 16}px"
    style:transform={magnify === 1 ? undefined : `scale(${magnify})`}
    title={running ? undefined : group.name}
    aria-label={group.name}
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={activate}
    {onauxclick}
    {oncontextmenu}
    {onmouseenter}
    onmouseleave={closePreview}
  >
    {#if icon}
      <img
        src={icon}
        alt=""
        draggable="false"
        style:width="{size}px"
        style:height="{size}px"
      />
    {:else}
      <span
        class="text-base-content/70"
        style:width="{size}px"
        style:height="{size}px"
      >
        <Icon icon="lucide:app-window" class="size-full" />
      </span>
    {/if}

    {#if running}
      <span
        class={[
          "absolute left-1/2 h-1 -translate-x-1/2 rounded-full transition-all duration-150",
          edge === "top" ? "top-0.5" : "bottom-0.5",
          active ? "w-4 bg-primary" : "w-1.5 bg-base-content/60",
        ]}
      ></span>
    {/if}
  </button>

  <ContextMenu
    bind:open
    items={menuItems}
    placement={edge === "top" ? "down" : "up"}
    align={alignEnd ? "end" : "start"}
    label={group.name}
    width={224}
    onsize={height => onmenu(open ? height : 0)}
  />
</div>
