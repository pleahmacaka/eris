<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { flip } from "svelte/animate"
  import { ContextMenu } from "@eris/ui"
  import type { MenuItem } from "@eris/ui"
  import { EditSpot } from "$lib/edit"
  import * as native from "$lib/native"
  import { dock, type DockGroup } from "./dock.svelte"
  import DockItem from "./DockItem.svelte"
  import EditOptions from "./EditOptions.svelte"
  import type { DockLayout } from "./layout.svelte"

  type Props = {
    layout: DockLayout
    list: DockGroup[]
    offset: number
    tail: boolean
  }

  let { layout, list, offset, tail }: Props = $props()

  let overflowOpen = $state(false)
  let openAtPress: boolean | null = null
  let toolbar = $state<HTMLElement>()

  const spotClaim = $derived(layout.claimFor("spot-apps"))
  const itemsClaim = $derived(layout.claimFor("items"))
  const overflowClaim = $derived(layout.claimFor("overflow"))

  const device = $derived(layout.device)

  const foreground = $derived(dock.windows[0]?.hwnd)

  const overflowItems = $derived.by((): MenuItem[] =>
    layout.spilled.map(group => ({
      label: group.name,
      icon: group.windows.length > 0 ? "lucide:app-window" : "lucide:box",
      action: () =>
        group.windows[0]
          ? native.activateWindow(group.windows[0].hwnd)
          : native.launchApp(group.path),
    })),
  )

  const toggleOverflow = () => {
    // the menu's window mousedown already closed it before this click lands
    overflowOpen = !(openAtPress ?? overflowOpen)
    openAtPress = null

    if (!overflowOpen) {
      overflowClaim(null)
    }
  }

  // the whole dock is the drop zone, so the empty space beside the first icon and the gaps still place a drop
  const track = (e: DragEvent) => {
    if (!layout.dragPath || !toolbar) {
      return
    }

    e.preventDefault()

    const slots = [...toolbar.querySelectorAll<HTMLElement>("[data-path]")]
    const next = slots.find(slot => {
      const box = slot.getBoundingClientRect()

      return e.clientX < box.left + box.width / 2
    })
    const target = next ?? slots.at(-1)

    if (!target) {
      return
    }

    layout.dropPath = target.dataset.path ?? null
    layout.dropBefore = next !== undefined
  }

  const drop = (e: DragEvent) => {
    if (!layout.dragPath) {
      return
    }

    e.preventDefault()
    layout.commitDrop()
  }
</script>

<svelte:window ondragover={track} ondrop={drop} />

<EditSpot id="apps" label={$t("edit.spots.apps")} placement={layout.spotPlacement} onmenu={spotClaim}>
  {#snippet options()}
    <EditOptions {layout} kind="apps" />
  {/snippet}

  <div
    bind:this={toolbar}
    role="toolbar"
    tabindex="-1"
    aria-label={$t("dock.apps")}
    class="flex min-w-0 items-center gap-0.5"
    onpointerenter={() => (layout.magnet.target = 1)}
    onpointermove={e => (layout.pointerX = e.clientX)}
    onpointerleave={() => (layout.magnet.target = 0)}
  >
    {#each list as group, index (group.key)}
      <div animate:flip={{ duration: 120 }} class="flex" data-path={group.path}>
        <DockItem
          {group}
          size={device.dockIconSize}
          edge={device.dockEdge}
          mac={layout.mac}
          {foreground}
          alignEnd={offset + index >= layout.shown.length / 2}
          hiddenHere={layout.hidden.has(group.path)}
          pointerX={layout.pointerX}
          strength={layout.magnet.current}
          dragging={layout.dragPath === group.path}
          dropBefore={layout.dropPath === group.path && layout.dropBefore}
          dropAfter={layout.dropPath === group.path && !layout.dropBefore}
          ondragstart={() => (layout.dragPath = group.path)}
          ondragend={() => {
            layout.dragPath = null
            layout.dropPath = null
          }}
          onmenu={itemsClaim}
        />
      </div>
    {/each}

    {#if tail && layout.spilled.length > 0}
      <div class="relative">
        <button
          class="btn btn-ghost btn-square"
          style:--size="{device.dockIconSize + 16}px"
          title={$t("dock.more", { values: { count: layout.spilled.length } })}
          aria-label={$t("dock.more", { values: { count: layout.spilled.length } })}
          aria-haspopup="menu"
          aria-expanded={overflowOpen}
          onpointerdown={() => (openAtPress = overflowOpen)}
          onclick={toggleOverflow}
        >
          <Icon icon="lucide:ellipsis" class="size-5 text-base-content/70" />
        </button>

        <ContextMenu
          bind:open={overflowOpen}
          items={overflowItems}
          placement={device.dockEdge === "top" ? "down" : "up"}
          label={$t("dock.moreApps")}
          onsize={rect => overflowClaim(rect)}
          onclose={() => overflowClaim(null)}
        />
      </div>
    {/if}
  </div>
</EditSpot>
