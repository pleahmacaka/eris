<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { ContextMenu, Logo } from "@eris/ui"
  import type { MenuItem } from "@eris/ui"
  import { EditSpot, editing, startEdit } from "#lib/edit/index.js"
  import * as native from "#lib/native/index.js"
  import AppsStrip from "./AppsStrip.svelte"
  import DockSpacer from "./DockSpacer.svelte"
  import EditOptions from "./EditOptions.svelte"
  import type { DockWidget } from "@eris/settings"
  import type { DockLayout } from "./layout.svelte"
  import LeadWidgets from "./LeadWidgets.svelte"
  import { rem } from "./rem.svelte"
  import Tray from "./Tray.svelte"

  type Props = {
    layout: DockLayout
    panelOpen: boolean
    onclock: () => void
  }

  let { layout, panelOpen, onclock }: Props = $props()

  const device = $derived(layout.device)

  const sideClass = $derived(
    layout.centered ? "z-10 min-w-max flex-1" : "z-10 min-w-max",
  )

  let barMenu = $state(false)
  let barMenuX = $state(0)

  const islands = $derived(device.dockIslands)

  let leadContent = $state(0)

  const leadClass = $derived(
    leadContent === 0 && !layout.centered && !editing.on
      ? `${sideClass} absolute! invisible`
      : sideClass,
  )

  const tint = "bg-linear-to-b from-dock-tint to-dock-tint"

  const fill = [
    "bg-card inset-ring inset-ring-base-content/10 borderless:inset-ring-0",
    tint,
  ]

  const island = [
    "dock-island h-dock-content rounded-full px-3 empty:hidden",
    "gathering:*:animate-dock-gather-content",
    fill,
  ]

  const barClaim = $derived(layout.claimFor("bar"))
  const launcherSpot = $derived(layout.claimFor("spot-launcher"))
  const traySpot = $derived(layout.claimFor("spot-tray"))

  const barMenuItems = $derived.by((): MenuItem[] => [
    ...(device.editMode
      ? ([
          {
            label: $t("dock.editLayout"),
            icon: "lucide:pencil-ruler",
            action: startEdit,
          },
          {
            label: $t("dock.addSpacer"),
            icon: "lucide:unfold-horizontal",
            action: () => layout.addSpacer(),
          },
          {
            label: $t("dock.resetLayout"),
            icon: "lucide:layout-template",
            action: () => layout.resetWidgets(),
          },
          "separator",
        ] as MenuItem[])
      : []),
    {
      label: $t("dock.taskManager"),
      icon: "lucide:activity",
      action: () => native.runCommand("taskmgr"),
    },
    {
      label: device.showSettingsButton
        ? $t("dock.hideSettingsButton")
        : $t("dock.showSettingsButton"),
      icon: "lucide:settings-2",
      action: () => layout.patch("showSettingsButton", !device.showSettingsButton),
    },
    "separator",
    {
      label: $t("dock.settings"),
      icon: "lucide:settings",
      action: () => native.showWindow("settings"),
    },
  ])

  const openBarMenu = (e: MouseEvent) => {
    if (
      e.defaultPrevented ||
      (e.target as Element).closest("button, [role=menu], input, a")
    ) {
      return
    }

    e.preventDefault()
    barMenuX = e.clientX
    barMenu = true
  }
</script>

{#snippet mark(size: string)}
  {#if device.dockIcon}
    <img src={device.dockIcon} alt="" draggable="false" class={[size, "object-contain"]} />
  {:else}
    <Logo class={size} />
  {/if}
{/snippet}

{#snippet launcherButton(round: boolean)}
  <EditSpot
    id="launcher"
    label={$t("edit.spots.launcher")}
    placement={layout.spotPlacement}
    class={round ? "size-full justify-center" : ""}
    onmenu={launcherSpot}
  >
    {#snippet options()}
      <EditOptions {layout} kind="launcher" />
    {/snippet}

    <button
      class={["btn btn-ghost btn-square", round && "size-full"]}
      style:width={round ? undefined : rem(device.dockIconSize + 16)}
      style:height={round ? undefined : rem(device.dockIconSize + 16)}
      title={$t("dock.launcher")}
      aria-label={$t("dock.openLauncher")}
      onclick={() => native.toggleWindow("main")}
    >
      <span
        class="grid place-items-center"
        style:width={rem(device.dockIconSize)}
        style:height={rem(device.dockIconSize)}
      >
        {@render mark("size-full")}
      </span>
    </button>
  </EditSpot>
{/snippet}

{#snippet widgetMove(widget: DockWidget, at: number)}
  <div class="flex items-center gap-1">
    <button
      type="button"
      class="btn btn-ghost btn-xs"
      disabled={at === 0}
      aria-label={$t("dock.moveLeft")}
      onclick={() => layout.moveWidget(widget.id, -1)}
    >
      <Icon icon="lucide:arrow-left" class="size-3.5" />
    </button>

    <button
      type="button"
      class="btn btn-ghost btn-xs"
      disabled={at === device.dockWidgets.length - 1}
      aria-label={$t("dock.moveRight")}
      onclick={() => layout.moveWidget(widget.id, 1)}
    >
      <Icon icon="lucide:arrow-right" class="size-3.5" />
    </button>
  </div>
{/snippet}

<div
  class={[
    "relative flex h-full select-none flex-col",
    device.dockEdge === "top" ? "justify-start" : "justify-end",
  ]}
>
  <div
    aria-hidden="true"
    class={[
      "pointer-events-none absolute left-1/2 z-20 grid -translate-x-1/2",
      "top-band-top bottom-band-bottom aspect-square place-items-center",
      "opacity-0 gathering:animate-dock-gather-pill",
      islands && ["rounded-full", fill],
    ]}
  >
    {@render mark("size-1/2")}
  </div>

  {#if layout.collapsed || layout.dockHidden}
    <div class="size-full" aria-hidden="true"></div>
  {:else}
    <nav
      class={[
        "flex shrink-0 items-center border-base-content/10",
        "borderless:border-transparent",
        layout.mac ? "rounded-shell px-3" : "px-2",
        layout.packed &&
          (device.dockAlign === "center" ? "justify-center" : "justify-start"),
        !islands && [
          "gap-1 gathering:*:animate-dock-gather-content",
          tint,
          "solid:bg-base-100 solid:bg-none",
          layout.mac ? "border" : device.dockEdge === "top" ? "border-b" : "border-t",
        ],
      ]}
      style:height={rem(layout.barHeight)}
      style:gap={islands ? rem(device.dockIslandGap) : undefined}
      aria-label={$t("dock.dockAria")}
      bind:offsetWidth={layout.navWidth}
      oncontextmenu={openBarMenu}
    >
      {#each device.dockWidgets as widget, at (widget.id)}
        {#if widget.kind === "lead"}
          <EditSpot
            id={`widget-${widget.id}`}
            label={$t("edit.spots.widgets")}
            placement={layout.spotPlacement}
            align="start"
            class={leadClass}
            onmenu={layout.claimFor(`spot-${widget.id}`)}
            dragKey={widget.id}
            ondropped={layout.moveWidgetTo}
          >
            {#snippet options()}
              {@render widgetMove(widget, at)}
            {/snippet}

            <div class={["flex items-center", layout.centered && "flex-1"]}>
              <div class={["flex items-center", islands && leadContent > 0 && island]} bind:clientWidth={layout.leadWidth}>
                <div class="flex items-center" bind:clientWidth={leadContent}>
                  {#if !device.topBar}
                    <LeadWidgets {layout} />
                  {/if}
                </div>
              </div>
            </div>
          </EditSpot>
        {:else if widget.kind === "apps"}
          <EditSpot
            id={`widget-${widget.id}`}
            label={$t("edit.spots.apps")}
            placement={layout.spotPlacement}
            class={layout.centered || layout.packed ? "" : "flex-1"}
            onmenu={layout.claimFor(`spot-${widget.id}`)}
            dragKey={widget.id}
            ondropped={layout.moveWidgetTo}
          >
            {#snippet options()}
              {@render widgetMove(widget, at)}
            {/snippet}

            <div
              class={[
                "flex min-w-0 items-center",
                !layout.centered && !layout.packed && "flex-1",
                device.dockAlign === "center" ? "justify-center" : "justify-start",
              ]}
            >
              {#if layout.launcherIsland}
                <div
                  class={[
                    "dock-island flex h-dock-content shrink-0 aspect-square",
                    "items-center justify-center rounded-full",
                    "gathering:*:animate-dock-gather-content",
                    fill,
                  ]}
                  style:margin-inline-end={rem(device.dockIslandGap)}
                >
                  {@render launcherButton(true)}
                </div>
              {/if}

              <div class={["flex min-w-0 items-center gap-0.5", islands && island]}>
                {#if layout.launcherShown && !islands}
                  {@render launcherButton(false)}

                  {#if device.dockSeparators}
                    <div class="mx-1.5 h-6 w-0.25 bg-base-content/10"></div>
                  {/if}
                {/if}

                <AppsStrip {layout} list={layout.shown} offset={0} tail={true} />
              </div>
            </div>
          </EditSpot>
        {:else if widget.kind === "tray"}
          <EditSpot
            id={`widget-${widget.id}`}
            label={$t("edit.spots.tray")}
            placement={layout.spotPlacement}
            align="end"
            class={sideClass}
            onmenu={layout.claimFor(`spot-${widget.id}`)}
            dragKey={widget.id}
            ondropped={layout.moveWidgetTo}
          >
            {#snippet options()}
              {@render widgetMove(widget, at)}
            {/snippet}

            <div class={["flex items-center justify-end", layout.centered && "flex-1"]}>
              <div class={["flex items-center", islands && island]} bind:clientWidth={layout.trailWidth}>
                {#if !device.topBar}
                  {#if device.dockSeparators && !islands}
                    <div class="mx-1.5 h-6 w-0.25 bg-base-content/10"></div>
                  {/if}

                  <EditSpot id="tray" label={$t("edit.spots.tray")} placement={layout.spotPlacement} align="end" onmenu={traySpot}>
                    {#snippet options()}
                      <EditOptions {layout} kind="tray" />
                    {/snippet}

                    <Tray {device} {panelOpen} {onclock} claimFor={layout.claimFor} />
                  </EditSpot>
                {/if}
              </div>
            </div>
          </EditSpot>
        {:else}
          <DockSpacer {layout} {widget} index={at} count={device.dockWidgets.length} />
        {/if}
      {/each}

      <ContextMenu
        bind:open={barMenu}
        items={barMenuItems}
        x={barMenuX}
        y={device.dockEdge === "top" ? layout.barHeight + 8 : undefined}
        bottom={device.dockEdge === "top" ? undefined : layout.barHeight + 8}
        placement={layout.spotPlacement}
        width={224}
        label={$t("dock.dockMenu")}
        onsize={rect => barClaim(barMenu ? rect : null)}
        onclose={() => barClaim(null)}
      />
    </nav>
  {/if}
</div>
