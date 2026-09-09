<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
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
    hidden?: string[]
    flat?: boolean
    onreorder?: (order: string[]) => void
    onhide?: (hidden: string[]) => void
    onmenu?: (height: number) => void
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

  let showAll = $state(false)

  const hiddenSet = $derived(new Set(hidden))

  const shown = $derived(flat ? sorted : sorted.filter(icon => icon.promoted))
  const overflow = $derived(flat ? [] : sorted.filter(icon => !icon.promoted))
  const stashed = $derived(
    overflow.filter(icon => showAll || !hiddenSet.has(icon.id)),
  )

  const COLUMNS = 6
  const ROW = 36
  const FOOTER = 40

  let stashOpen = $state(false)

  let row = $state<HTMLElement>()

  const closeStash = () => {
    if (!stashOpen) {
      return
    }

    stashOpen = false
    onmenu?.(0)
  }

  const stashHeight = () =>
    Math.max(1, Math.ceil(stashed.length / COLUMNS)) * ROW + FOOTER + 24

  const toggleStash = () => {
    stashOpen = !stashOpen

    onmenu?.(stashOpen ? stashHeight() : 0)
  }

  $effect(() => {
    if (stashOpen) {
      onmenu?.(stashHeight())
    }
  })

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

  const hiddenCount = $derived(overflow.filter(icon => hiddenSet.has(icon.id)).length)
</script>

{#snippet trayButton(icon: TrayIcon, small: boolean)}
  <button
    class={["btn btn-ghost btn-square", small ? "btn-sm" : compact ? "btn-xs" : "btn-sm"]}
    title={icon.tooltip}
    aria-label={icon.tooltip || $t("tray.icons.icon")}
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

    {#if stashOpen && overflow.length > 0}
      <div
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

              <div class={["relative", off && "opacity-40"]}>
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
{/if}
