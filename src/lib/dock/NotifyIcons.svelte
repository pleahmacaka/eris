<script lang="ts">
  import Icon from "@iconify/svelte"
  import { flip } from "svelte/animate"
  import {
    notifyIconClick,
    notifyIconPromote,
    notifyIcons,
    onTrayIcons,
    type TrayIcon,
  } from "$lib/native"
  import type { DockEdge } from "$lib/settings"

  type Props = {
    compact?: boolean
    edge?: DockEdge
    order?: string[]
    onreorder?: (order: string[]) => void
    onmenu?: (height: number) => void
  }

  let {
    compact = false,
    edge = "bottom",
    order = [],
    onreorder,
    onmenu,
  }: Props = $props()

  const SWEEP = 15_000

  let icons = $state<TrayIcon[]>([])

  const refresh = async () => {
    icons = await notifyIcons().catch(() => icons)
  }

  $effect(() => {
    refresh()

    const timer = setInterval(refresh, SWEEP)
    const stop = onTrayIcons(refresh)

    return () => {
      clearInterval(timer)
      stop.then(off => off()).catch(() => undefined)
      onmenu?.(0)
    }
  })

  const click = (id: string, button: "left" | "right") => {
    notifyIconClick(id, button).catch(() => undefined)
  }

  const promote = async (id: string, next: boolean) => {
    await notifyIconPromote(id, next).catch(() => undefined)
    await refresh()

    // the panel is where the icon just went, so keep it up instead of making the user reopen it
    if (stashed.length === 0) {
      closeStash()

      return
    }

    stashOpen = true
    onmenu?.(stashHeight())
  }

  const sorted = $derived.by(() => {
    const rank = new Map(order.map((id, index) => [id, index]))

    return [...icons].sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  })

  const shown = $derived(sorted.filter(icon => icon.promoted))
  const stashed = $derived(sorted.filter(icon => !icon.promoted))

  const COLUMNS = 6
  const ROW = 36

  let stashOpen = $state(false)

  let row = $state<HTMLElement>()

  const closeStash = () => {
    if (!stashOpen) {
      return
    }

    stashOpen = false
    onmenu?.(0)
  }

  const stashHeight = () => Math.ceil(stashed.length / COLUMNS) * ROW + 24

  const toggleStash = () => {
    stashOpen = !stashOpen

    onmenu?.(stashOpen ? stashHeight() : 0)
  }

  const onwindowdown = (e: MouseEvent) => {
    if (stashOpen && row && !row.contains(e.target as Node)) {
      closeStash()
    }
  }

  let dragId = $state<string | null>(null)
  let dragStashed = $state(false)
  let dropId = $state<string | null>(null)
  let dropBefore = $state(true)

  const dragOver = (e: DragEvent, id: string) => {
    e.preventDefault()

    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()

    dropId = id
    dropBefore = e.clientX < box.left + box.width / 2
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()

    if (dragStashed) {
      return
    }

    const from = dragId
    const onto = dropId
    const before = dropBefore

    dragId = null
    dropId = null

    if (!from || !onto || from === onto) {
      return
    }

    const ids = sorted.map(icon => icon.id).filter(id => id !== from)
    const at = ids.indexOf(onto)

    if (at < 0) {
      return
    }

    ids.splice(before ? at : at + 1, 0, from)
    onreorder?.(ids)
  }
</script>

{#snippet trayButton(icon: TrayIcon, small: boolean)}
  <button
    class={["btn btn-ghost btn-square", small ? "btn-sm" : compact ? "btn-xs" : "btn-sm"]}
    title={icon.tooltip}
    aria-label={icon.tooltip || "Tray icon"}
    draggable="true"
    ondragstart={e => {
      e.dataTransfer?.setData("text/plain", icon.id)
      dragId = icon.id
      dragStashed = !icon.promoted
    }}
    onclick={() => {
      click(icon.id, "left")
      closeStash()
    }}
    oncontextmenu={e => {
      e.preventDefault()
      click(icon.id, "right")
    }}
  >
    {#if icon.icon}
      <img src={icon.icon} alt="" class="size-4" draggable="false" />
    {:else}
      <span class="size-2 rounded-full bg-base-content/40"></span>
    {/if}
  </button>
{/snippet}

<svelte:window onmousedown={onwindowdown} />

{#if icons.length > 0}
  <div
    class="relative flex items-center gap-px"
    role="list"
    bind:this={row}
    ondragover={e => e.preventDefault()}
    ondrop={e => {
      e.preventDefault()

      if (dragId && dragStashed) {
        promote(dragId, true)
      }

      dragId = null
      dragStashed = false
    }}
  >
    {#if stashed.length > 0}
      <button
        class={["btn btn-ghost btn-square", compact ? "btn-xs" : "btn-sm"]}
        title="{stashed.length} hidden icons"
        aria-label="Hidden tray icons"
        aria-haspopup="true"
        aria-expanded={stashOpen}
        onclick={toggleStash}
        ondragover={e => e.preventDefault()}
        ondrop={e => {
          e.preventDefault()

          if (dragId && !dragStashed) {
            promote(dragId, false)
          }

          dragId = null
        }}
      >
        <Icon
          icon={edge === "top" ? "lucide:chevron-down" : "lucide:chevron-up"}
          class="size-4 text-base-content/70"
        />
      </button>
    {/if}

    {#each shown as icon (icon.id)}
      <div
        animate:flip={{ duration: 180 }}
        role="listitem"
        class={[
          "relative flex transition-opacity duration-150",
          dragId === icon.id && "opacity-30",
        ]}
        ondragover={e => dragOver(e, icon.id)}
        ondrop={drop}
        ondragend={() => {
          dragId = null
          dropId = null
        }}
      >
        {#if dropId === icon.id && dropBefore}
          <span
            class="pointer-events-none absolute inset-y-1 -left-0.5 w-0.5 rounded-full bg-primary"
          ></span>
        {/if}

        {#if dropId === icon.id && !dropBefore}
          <span
            class="pointer-events-none absolute inset-y-1 -right-0.5 w-0.5 rounded-full bg-primary"
          ></span>
        {/if}

        {@render trayButton(icon, false)}
      </div>
    {/each}

    {#if stashOpen && stashed.length > 0}
      <div
        class={[
          "absolute right-0 z-50 grid w-max grid-cols-6 gap-0.5 rounded-box border border-base-content/10 bg-base-100/95 p-2 shadow-2xl backdrop-blur-xl",
          edge === "top" ? "top-full mt-2" : "bottom-full mb-2",
        ]}
        role="group"
        aria-label="Hidden tray icons"
        ondragover={e => e.preventDefault()}
        ondrop={e => {
          e.preventDefault()

          if (dragId && !dragStashed) {
            promote(dragId, false)
          }

          dragId = null
        }}
      >
        {#each stashed as icon (icon.id)}
          {@render trayButton(icon, true)}
        {/each}
      </div>
    {/if}
  </div>
{/if}
