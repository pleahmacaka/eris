<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { MenuBox } from "./layout.svelte"
  import { t } from "svelte-i18n"
  import { flip } from "svelte/animate"
  import { notifyIconClick, notifyIconPromote, notifyIcons, onTrayIcons, type TrayIcon } from "$lib/native/tray"
  import type { DockEdge } from "@eris/settings"
  import { ContextMenu } from "@eris/ui"
  import type { MenuItem } from "@eris/ui"

  type Props = {
    compact?: boolean
    edge?: DockEdge
    order?: string[]
    hidden?: string[]
    flat?: boolean
    onreorder?: (order: string[]) => void
    onhide?: (hidden: string[]) => void
    onmenu?: (rect: MenuBox | null) => void
  }

  let {
    compact = false,
    edge = "bottom",
    order = [],
    hidden = [],
    flat = false,
    onreorder,
    onhide,
    onmenu,
  }: Props = $props()

  const SWEEP = 15_000
  const TRAY_ICON = "application/x-eris-tray-icon"

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
      onmenu?.(null)
    }
  })

  const click = (id: string, button: "left" | "right") => {
    notifyIconClick(id, button).catch(() => undefined)
  }

  const setHidden = (id: string, next: boolean) => {
    const rest = hidden.filter(found => found !== id)

    onhide?.(next ? [...rest, id] : rest)
  }

  const promote = async (id: string, next: boolean) => {
    await notifyIconPromote(id, next).catch(() => undefined)
    await refresh()

    if (next && hidden.includes(id)) {
      setHidden(id, false)
    }

    // the panel is where the icon just went, so keep it up instead of making the user reopen it
    if (overflow.length === 0) {
      closeStash()

      return
    }

    stashOpen = true
  }

  const sorted = $derived.by(() => {
    const rank = new Map(order.map((id, index) => [id, index]))

    return [...icons].sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  })

  const hiddenSet = $derived(new Set(hidden))

  let showAll = $state(false)

  const shown = $derived(flat ? sorted : sorted.filter(icon => icon.promoted))
  const overflow = $derived(flat ? [] : sorted.filter(icon => !icon.promoted))
  const stashed = $derived(
    overflow.filter(icon => showAll || !hiddenSet.has(icon.id)),
  )
  const hiddenCount = $derived(
    overflow.filter(icon => hiddenSet.has(icon.id)).length,
  )

  let stashOpen = $state(false)

  let row = $state<HTMLElement>()
  let stash = $state<HTMLElement>()
  let stashHeight = $state(0)

  const closeStash = () => {
    if (!stashOpen) {
      return
    }

    stashOpen = false
    onmenu?.(null)
  }

  const toggleStash = () => {
    stashOpen = !stashOpen

    if (!stashOpen) {
      onmenu?.(null)
    }
  }

  $effect(() => {
    if (stashOpen && stash && stashHeight > 0) {
      onmenu?.(stash.getBoundingClientRect())
    }
  })

  const onwindowdown = (e: MouseEvent) => {
    if (stashOpen && row && !row.contains(e.target as Node)) {
      closeStash()
    }
  }

  $effect(() => {
    window.addEventListener("eris-close-menus", closeStash)

    return () => window.removeEventListener("eris-close-menus", closeStash)
  })

  let dragId = $state<string | null>(null)
  let dragStashed = $state(false)
  let dropId = $state<string | null>(null)
  let dropBefore = $state(true)

  const dragOver = (e: DragEvent, id: string) => {
    if (!dragId) {
      return
    }

    e.preventDefault()

    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()

    dropId = id
    dropBefore = e.clientX < box.left + box.width / 2
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()

    const from = dragId
    const onto = dropId
    const before = dropBefore
    const wasStashed = dragStashed

    dragId = null
    dropId = null
    dragStashed = false

    if (!from) {
      return
    }

    if (wasStashed) {
      if (onto && onto !== from) {
        const ids = sorted.map(icon => icon.id).filter(id => id !== from)
        const at = ids.indexOf(onto)

        if (at >= 0) {
          ids.splice(before ? at : at + 1, 0, from)
          onreorder?.(ids)
        }
      }

      void promote(from, true)

      return
    }

    if (!onto || from === onto) {
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

  let iconMenuId = $state<string | null>(null)
  let iconMenuOpen = $state(false)
  let iconMenuX = $state(0)
  let iconMenuY = $state(0)

  const openIconMenu = (e: MouseEvent, icon: TrayIcon) => {
    e.preventDefault()
    iconMenuId = icon.id
    iconMenuOpen = true
    iconMenuX = e.clientX
    iconMenuY = e.clientY
  }

  const iconMenuItems = $derived.by((): MenuItem[] => {
    const icon = sorted.find(found => found.id === iconMenuId)

    if (!icon) {
      return []
    }

    const off = hiddenSet.has(icon.id)

    return [
      {
        label: $t("tray.icons.appMenu"),
        icon: "lucide:app-window",
        action: () => click(icon.id, "right"),
      },
      icon.promoted || !off
        ? {
            label: $t("tray.icons.hideFromDock"),
            icon: "lucide:eye-off",
            action: () => {
              void notifyIconPromote(icon.id, false).catch(() => undefined)
              setHidden(icon.id, true)
            },
          }
        : {
            label: $t("tray.icons.showInDock"),
            icon: "lucide:eye",
            action: () => void promote(icon.id, true),
          },
    ]
  })

  const closeIconMenu = () => {
    iconMenuOpen = false
    iconMenuId = null
    onmenu?.(null)
  }
</script>

{#snippet trayButton(icon: TrayIcon, small: boolean)}
  <button
    class={["btn btn-ghost btn-square", small ? "btn-sm" : compact ? "btn-xs" : "btn-sm"]}
    title={icon.tooltip}
    aria-label={icon.tooltip || $t("tray.icons.icon")}
    draggable="true"
    ondragstart={e => {
      e.dataTransfer?.setData("text/plain", icon.id)
      e.dataTransfer?.setData(TRAY_ICON, icon.id)
      dragId = icon.id
      dragStashed = !icon.promoted
    }}
    onclick={() => {
      click(icon.id, "left")
      closeStash()
    }}
    oncontextmenu={e => openIconMenu(e, icon)}
  >
    {#if icon.icon}
      <img src={icon.icon} alt="" class="size-4" draggable="false" />
    {:else}
      <span class="size-2 rounded-full bg-base-content/40"></span>
    {/if}
  </button>
{/snippet}

<svelte:window
  onmousedown={onwindowdown}
  ondragover={e => {
    if (e.dataTransfer?.types.includes(TRAY_ICON)) {
      e.preventDefault()
    }
  }}
  ondrop={e => {
    const dropped = e.dataTransfer?.getData(TRAY_ICON)

    if (!dropped || e.defaultPrevented) {
      return
    }

    dragId = null
    dropId = null
    dragStashed = false
    void promote(dropped, true)
  }}
/>

{#if icons.length > 0}
  <div
    class={["relative flex items-center gap-px", flat && "flex-wrap justify-end"]}
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
    {#if overflow.length > 0}
      <button
        class={["btn btn-ghost btn-square", compact ? "btn-xs" : "btn-sm"]}
        title={$t("tray.icons.hiddenCount", { values: { count: overflow.length } })}
        aria-label={$t("tray.icons.hidden")}
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
        animate:flip={{ duration: 120 }}
        role="listitem"
        class={[
          "relative flex transition-opacity duration-100",
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

    {#if stashOpen && overflow.length > 0}
      <div
        bind:this={stash}
        bind:offsetHeight={stashHeight}
        class={[
          "absolute right-0 z-50 w-max rounded-box border border-base-content/10 bg-base-100/95 p-2 shadow-2xl backdrop-blur-xl",
          edge === "top" ? "top-full mt-2" : "bottom-full mb-2",
        ]}
        role="group"
        aria-label={$t("tray.icons.hidden")}
        ondragover={e => e.preventDefault()}
        ondrop={e => {
          e.preventDefault()

          if (dragId && !dragStashed) {
            promote(dragId, false)
          }

          dragId = null
        }}
      >
        {#if stashed.length > 0}
          <div class="grid grid-cols-6 gap-0.5">
            {#each stashed as icon (icon.id)}
              {@const off = hiddenSet.has(icon.id)}

              <div
                class={["relative", off && "opacity-40"]}
                role="listitem"
                ondragend={() => {
                  dragId = null
                  dropId = null
                  dragStashed = false
                }}
              >
                {@render trayButton(icon, true)}

                {#if showAll}
                  <button
                    type="button"
                    class="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-base-300 text-base-content/70 shadow hover:bg-base-content/20"
                    title={off ? $t("tray.icons.unhide") : $t("tray.icons.hide")}
                    aria-label={off ? $t("tray.icons.unhide") : $t("tray.icons.hide")}
                    onclick={e => {
                      e.stopPropagation()
                      setHidden(icon.id, !off)
                    }}
                  >
                    <Icon icon={off ? "lucide:eye" : "lucide:eye-off"} class="size-2.5" />
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <p class="px-2 py-2 text-center text-xs text-base-content/40">
            {$t("tray.icons.allHidden", { values: { count: hiddenCount } })}
          </p>
        {/if}

        <label
          class="mt-2 flex min-w-40 cursor-pointer items-center justify-between gap-3 border-t border-base-content/10 px-1 pt-2 text-xs text-base-content/70"
        >
          <span>{$t("tray.icons.showAll")}</span>

          <input type="checkbox" class="toggle toggle-primary toggle-xs" bind:checked={showAll} />
        </label>
      </div>
    {/if}
  </div>

  <ContextMenu
    bind:open={iconMenuOpen}
    items={iconMenuItems}
    x={iconMenuX}
    y={iconMenuY}
    placement={edge === "top" ? "down" : "up"}
    label={$t("tray.icons.icon")}
    onsize={rect => onmenu?.(rect)}
    onclose={closeIconMenu}
  />
{/if}
