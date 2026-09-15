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
</script>

<EditSpot id="apps" label={$t("edit.spots.apps")} placement={layout.spotPlacement} onmenu={spotClaim}>
  {#snippet options()}
    <EditOptions {layout} kind="apps" />
  {/snippet}

  <div
    role="toolbar"
    tabindex="-1"
    aria-label={$t("dock.apps")}
    class="flex min-w-0 items-center gap-0.5"
    onpointermove={e => (layout.pointerX = e.clientX)}
    onpointerleave={() => (layout.pointerX = null)}
  >
    {#each list as group, index (group.key)}
      <div animate:flip={{ duration: 120 }} class="flex">
        <DockItem
          {group}
          size={device.dockIconSize}
          edge={device.dockEdge}
          mac={layout.mac}
          {foreground}
          alignEnd={offset + index >= layout.shown.length / 2}
          hiddenHere={layout.hidden.has(group.path)}
          pointerX={layout.pointerX}
          dragging={layout.dragPath === group.path}
          dropBefore={layout.dropPath === group.path && layout.dropBefore}
          dropAfter={layout.dropPath === group.path && !layout.dropBefore}
          ondragstart={() => (layout.dragPath = group.path)}
          ondragover={before => {
            layout.dropPath = group.path
            layout.dropBefore = before
          }}
          ondrop={layout.commitDrop}
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
          onclick={() => {
            overflowOpen = !overflowOpen

            if (!overflowOpen) {
              overflowClaim(null)
            }
          }}
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
