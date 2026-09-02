<script lang="ts">
  import Icon from "@iconify/svelte"
  import * as native from "$lib/native"
  import type { DockEdge } from "$lib/settings"
  import { type DockGroup, iconFor, toggleDockPin } from "./dock.svelte"

  type Props = {
    group: DockGroup
    size: number
    edge: DockEdge
    mac: boolean
    foreground: number | undefined
    alignEnd: boolean
    onmenu: (height: number) => void
  }

  let { group, size, edge, mac, foreground, alignEnd, onmenu }: Props =
    $props()

  const MENU_ROW = 34
  const MENU_PAD = 28
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
    const [first, second] = group.windows

    if (!first) {
      return launch()
    }

    const target = first.hwnd === foreground && second ? second : first

    return native.activateWindow(target.hwnd).catch(() => undefined)
  }

  const closeAll = async () => {
    for (const w of group.windows) {
      await native.closeWindow(w.hwnd).catch(() => undefined)
    }
  }

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
    setOpen(true)
  }

  const outside = (e: MouseEvent) => {
    if (open && root && !root.contains(e.target as Node)) {
      setOpen(false)
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (open && e.key === "Escape") {
      setOpen(false)
    }
  }

  const run = (action: () => unknown) => {
    setOpen(false)
    action()
  }
</script>

<svelte:window onmousedown={outside} {onkeydown} onblur={() => setOpen(false)} />

<div
  bind:this={root}
  class={[
    "dropdown",
    edge === "top" ? "dropdown-bottom" : "dropdown-top",
    alignEnd && "dropdown-end",
    open && "dropdown-open",
  ]}
>
  <button
    class={[
      "btn btn-ghost btn-square relative transition-transform duration-150",
      mac && "hover:scale-[1.15] active:scale-95",
      active && "bg-base-content/10",
    ]}
    style:--size="{size + 16}px"
    title={group.name}
    aria-label={group.name}
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={activate}
    {onauxclick}
    {oncontextmenu}
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

  {#if open}
    <ul
      class="menu dropdown-content z-10 mb-2 w-56 rounded-box border border-base-content/10 bg-base-100/90 p-1.5 shadow-lg backdrop-blur-xl"
      class:mt-2={edge === "top"}
      role="menu"
    >
      {#each group.windows.slice(0, MENU_MAX_ROWS - 4) as w (w.hwnd)}
        <li role="none">
          <button
            role="menuitem"
            class="gap-2"
            onclick={() => run(() => native.activateWindow(w.hwnd))}
          >
            <span
              class={[
                "size-1.5 shrink-0 rounded-full",
                w.hwnd === foreground ? "bg-primary" : "bg-base-content/40",
              ]}
            ></span>

            <span class="truncate">{w.title}</span>
          </button>
        </li>
      {/each}

      {#if running}
        <li class="my-1 border-t border-base-content/10" role="separator"></li>
      {/if}

      <li role="none">
        <button role="menuitem" class="gap-2" onclick={() => run(launch)}>
          <Icon icon="lucide:plus" class="size-4 text-base-content/60" />

          Open new window
        </button>
      </li>

      {#if running}
        <li role="none">
          <button role="menuitem" class="gap-2" onclick={() => run(closeAll)}>
            <Icon icon="lucide:x" class="size-4 text-base-content/60" />

            Close all
          </button>
        </li>
      {/if}

      <li role="none">
        <button
          role="menuitem"
          class="gap-2"
          onclick={() => run(() => native.openLocation(group.path))}
        >
          <Icon icon="lucide:folder-open" class="size-4 text-base-content/60" />

          Open file location
        </button>
      </li>

      <li role="none" class={[group.pinned === "windows" && "menu-disabled"]}>
        <button
          role="menuitem"
          class="gap-2"
          disabled={group.pinned === "windows"}
          onclick={() => run(() => toggleDockPin(group.path))}
        >
          <Icon
            icon={group.pinned === "device" ? "lucide:pin-off" : "lucide:pin"}
            class="size-4 text-base-content/60"
          />

          {group.pinned === "windows"
            ? "Pinned by Windows"
            : group.pinned
              ? "Unpin from dock"
              : "Pin to dock"}
        </button>
      </li>
    </ul>
  {/if}
</div>
