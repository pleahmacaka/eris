<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { ContextMenu, Logo } from "@eris/ui"
  import type { MenuItem } from "@eris/ui"
  import { EditSpot, startEdit } from "$lib/edit"
  import * as native from "$lib/native"
  import AppsStrip from "./AppsStrip.svelte"
  import DockSpacer from "./DockSpacer.svelte"
  import EditOptions from "./EditOptions.svelte"
  import type { DockWidget } from "@eris/settings"
  import type { DockLayout } from "./layout.svelte"
  import LeadWidgets from "./LeadWidgets.svelte"
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

  const pillSize = $derived(islands ? device.dockHeight - 8 : device.dockHeight)

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

{#snippet launcherButton()}
  <EditSpot id="launcher" label={$t("edit.spots.launcher")} placement={layout.spotPlacement} onmenu={launcherSpot}>
    {#snippet options()}
      <EditOptions {layout} kind="launcher" />
    {/snippet}

    <button
      class="btn btn-ghost btn-square btn-sm"
      title={$t("dock.launcher")}
      aria-label={$t("dock.openLauncher")}
      onclick={() => native.toggleWindow("main")}
    >
      {@render mark("size-4")}
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
      "dock-pill pointer-events-none absolute left-1/2 z-20 grid -translate-x-1/2 place-items-center",
      islands && "island-fill rounded-full",
      device.dockEdge === "top" ? (islands ? "top-1" : "top-0") : islands ? "bottom-1" : "bottom-0",
    ]}
    style:width="{pillSize}px"
    style:height="{pillSize}px"
  >
    {@render mark("size-1/2")}
  </div>

  {#if layout.collapsed || layout.dockHidden}
    <div class="h-full w-full" aria-hidden="true"></div>
  {:else}
    <nav
      class={[
        "dock-nav flex shrink-0 items-center border-base-content/10",
        islands ? "islands" : "gap-1",
        layout.mac ? "rounded-[var(--shell-radius)] px-3" : "px-2",
        !islands && (layout.mac ? "border" : device.dockEdge === "top" ? "border-b" : "border-t"),
      ]}
      style:height="{device.dockHeight}px"
      style:gap={islands ? `${device.dockIslandGap}px` : undefined}
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
            class={sideClass}
            onmenu={layout.claimFor(`spot-${widget.id}`)}
          >
            {#snippet options()}
              {@render widgetMove(widget, at)}
            {/snippet}

            <div class={["flex items-center", layout.centered && "flex-1"]}>
              <div class={["flex items-center", islands && "dock-island"]} bind:clientWidth={layout.leadWidth}>
                {#if !device.topBar}
                  <LeadWidgets {layout} />
                {/if}
              </div>
            </div>
          </EditSpot>
        {:else if widget.kind === "apps"}
          <EditSpot
            id={`widget-${widget.id}`}
            label={$t("edit.spots.apps")}
            placement={layout.spotPlacement}
            class={layout.centered ? "" : "flex-1"}
            onmenu={layout.claimFor(`spot-${widget.id}`)}
          >
            {#snippet options()}
              {@render widgetMove(widget, at)}
            {/snippet}

            <div
              class={[
                "flex min-w-0 items-center",
                !layout.centered && "flex-1",
                device.dockAlign === "center" ? "justify-center" : "justify-start",
              ]}
            >
              <div class={["flex min-w-0 items-center gap-0.5", islands && "dock-island"]}>
                {#if device.showLauncherButton && device.features.launcher}
                  {@render launcherButton()}

                  {#if device.dockSeparators}
                    <div class="mx-1.5 h-6 w-px bg-base-content/10"></div>
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
          >
            {#snippet options()}
              {@render widgetMove(widget, at)}
            {/snippet}

            <div class={["flex items-center justify-end", layout.centered && "flex-1"]}>
              <div class={["flex items-center", islands && "dock-island"]} bind:clientWidth={layout.trailWidth}>
                {#if !device.topBar}
                  {#if device.dockSeparators && !islands}
                    <div class="mx-1.5 h-6 w-px bg-base-content/10"></div>
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
        y={device.dockEdge === "top" ? device.dockHeight + 8 : undefined}
        bottom={device.dockEdge === "top" ? undefined : device.dockHeight + 8}
        placement={layout.spotPlacement}
        width={224}
        label={$t("dock.dockMenu")}
        onsize={rect => barClaim(barMenu ? rect : null)}
        onclose={() => barClaim(null)}
      />
    </nav>
  {/if}
</div>

<style>
  :global(.siri-aura) {
    mask-image: none;
  }

  :global(:root[data-edge="bottom"] .siri-aura) {
    top: auto;
    height: var(--dock-height);
  }

  :global(:root[data-edge="top"] .siri-aura) {
    bottom: auto;
    height: var(--dock-height);
  }

  :global(:root[data-background="solid"] .siri-shell),
  :global(:root[data-background="glass"] .siri-shell) {
    background: transparent;
    box-shadow: none;
  }

  :global(:root[data-background="solid"]) nav:not(.islands) {
    background: var(--color-base-100);
  }

  nav:not(.islands),
  .dock-island,
  .island-fill {
    background-image: linear-gradient(
      oklch(62% calc(var(--vividness) + 0.08) var(--accent-hue) / var(--dock-tint, 0)),
      oklch(62% calc(var(--vividness) + 0.08) var(--accent-hue) / var(--dock-tint, 0))
    );
  }

  :global(:root[data-dock-border="false"]) nav {
    border-color: transparent;
  }

  .dock-island {
    height: calc(var(--dock-height) - 0.5rem);
    padding-inline: 0.5rem;
    border-radius: 9999px;
  }

  .dock-island:empty {
    display: none;
  }

  .dock-island :global([data-media] > [role="group"]) {
    border-color: transparent;
  }

  .dock-island,
  .island-fill {
    background-color: var(--card-bg);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--color-base-content) 10%, transparent);
  }

  :global(:root[data-dock-border="false"]) :is(.dock-island, .island-fill) {
    box-shadow: none;
  }
</style>
