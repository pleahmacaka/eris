<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { ContextMenu } from "@eris/ui"
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
  import UchiwaStrip from "./UchiwaStrip.svelte"

  type Props = {
    layout: DockLayout
    panelOpen: boolean
    onclock: () => void
  }

  let { layout, panelOpen, onclock }: Props = $props()

  const device = $derived(layout.device)

  const centered = $derived(
    !layout.mac && !layout.uchiwa && device.dockAlign === "center",
  )

  let barMenu = $state(false)
  let barMenuX = $state(0)

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
      label: device.showRunningApps ? $t("dock.hideRunning") : $t("dock.showRunning"),
      icon: device.showRunningApps ? "lucide:eye-off" : "lucide:eye",
      action: () => layout.patch("showRunningApps", !device.showRunningApps),
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
      <Icon icon="lucide:sparkles" class="size-4 text-primary" />
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
    "flex h-full select-none flex-col",
    device.dockEdge === "top" ? "justify-start" : "justify-end",
  ]}
>
  {#if layout.collapsed || layout.dockHidden}
    <div class="h-full w-full" aria-hidden="true"></div>
  {:else}
    <nav
      class={[
        "dock-nav flex shrink-0 items-center gap-1 border-base-content/10",
        layout.mac || layout.uchiwa
          ? "rounded-[var(--shell-radius)] border px-3"
          : "px-2",
        !layout.mac &&
          !layout.uchiwa &&
          (device.dockEdge === "top" ? "border-b" : "border-t"),
      ]}
      style:height="{device.dockHeight}px"
      aria-label={$t("dock.dockAria")}
      bind:clientWidth={layout.navWidth}
      oncontextmenu={openBarMenu}
    >
      {#each device.dockWidgets as widget, at (widget.id)}
        {#if widget.kind === "lead"}
          <EditSpot
            id={`widget-${widget.id}`}
            label={$t("edit.spots.widgets")}
            placement={layout.spotPlacement}
            align="start"
            class={centered ? "flex-1" : ""}
            onmenu={layout.claimFor(`spot-${widget.id}`)}
          >
            {#snippet options()}
              {@render widgetMove(widget, at)}
            {/snippet}

            <div
              class={[
                "flex min-w-0 items-center gap-1",
                centered && "flex-1",
              ]}
            >
              {#if layout.uchiwa && device.showLauncherButton && device.features.launcher}
                {@render launcherButton()}
              {/if}

              <div class="flex items-center" bind:clientWidth={layout.leadWidth}>
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
            class={!layout.uchiwa && !centered ? "flex-1" : ""}
            onmenu={layout.claimFor(`spot-${widget.id}`)}
          >
            {#snippet options()}
              {@render widgetMove(widget, at)}
            {/snippet}

            <div
              class={[
                "flex min-w-0 items-center gap-0.5",
                layout.uchiwa || centered ? "" : "flex-1",
                layout.uchiwa || device.dockAlign === "center"
                  ? "justify-center"
                  : "justify-start",
              ]}
            >
              {#if layout.uchiwa}
                <UchiwaStrip {layout} />
              {:else}
                {#if device.showLauncherButton && device.features.launcher}
                  {@render launcherButton()}

                  {#if device.dockSeparators}
                    <div class="mx-1.5 h-6 w-px bg-base-content/10"></div>
                  {/if}
                {/if}

                <AppsStrip {layout} list={layout.shown} offset={0} tail={true} />
              {/if}
            </div>
          </EditSpot>
        {:else if widget.kind === "tray"}
          <EditSpot
            id={`widget-${widget.id}`}
            label={$t("edit.spots.tray")}
            placement={layout.spotPlacement}
            align="end"
            class={centered ? "flex-1" : ""}
            onmenu={layout.claimFor(`spot-${widget.id}`)}
          >
            {#snippet options()}
              {@render widgetMove(widget, at)}
            {/snippet}

            <div
              class={[
                "flex min-w-0 items-center justify-end",
                centered && "flex-1",
              ]}
            >
              <div class="flex items-center" bind:clientWidth={layout.trailWidth}>
                {#if !device.topBar}
                  {#if device.dockSeparators}
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
        bottom={device.dockHeight + 8}
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

  :global(:root[data-background="solid"]) nav {
    background: var(--color-base-100);
  }

  nav {
    background-image: linear-gradient(
      oklch(62% calc(var(--vividness) + 0.08) var(--accent-hue) / var(--dock-tint, 0)),
      oklch(62% calc(var(--vividness) + 0.08) var(--accent-hue) / var(--dock-tint, 0))
    );
  }

  :global(:root[data-dock-border="false"]) nav {
    border-color: transparent;
  }
</style>
