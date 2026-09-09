<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { ContextMenu } from "@eris/ui"
  import type { MenuItem } from "@eris/ui"
  import { EditSpot, startEdit } from "$lib/edit"
  import * as native from "$lib/native"
  import AppsStrip from "./AppsStrip.svelte"
  import EditOptions from "./EditOptions.svelte"
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

  let barMenu = $state(false)
  let barMenuX = $state(0)

  const barMenuItems = $derived.by((): MenuItem[] => [
    ...(device.editMode
      ? ([
          {
            label: $t("dock.editLayout"),
            icon: "lucide:pencil-ruler",
            action: startEdit,
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
    if ((e.target as Element).closest("button, [role=menu], input, a")) {
      return
    }

    e.preventDefault()
    barMenuX = e.clientX
    barMenu = true
  }
</script>

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
        "shrink-0 items-center gap-1 border-base-content/10",
        layout.mac ? "rounded-[var(--shell-radius)] border px-3" : "px-2",
        !layout.mac && (device.dockEdge === "top" ? "border-b" : "border-t"),
        layout.uchiwa || (!layout.mac && device.dockAlign === "center")
          ? "grid grid-cols-[1fr_auto_1fr]"
          : layout.mac
            ? "flex justify-between"
            : "grid grid-cols-[auto_1fr_auto]",
      ]}
      style:height="{device.dockHeight}px"
      aria-label={$t("dock.dockAria")}
      bind:clientWidth={layout.navWidth}
      oncontextmenu={openBarMenu}
    >
      <div
        class={[
          "flex items-center",
          layout.uchiwa ? "justify-between gap-1" : "justify-self-start",
        ]}
      >
        <div class="flex items-center" bind:clientWidth={layout.leadWidth}>
          <LeadWidgets {layout} />
        </div>

        {#if layout.uchiwa}
          <AppsStrip {layout} list={layout.leftShown} offset={0} tail={false} />
        {/if}
      </div>

      <div
        class={[
          "flex min-w-0 items-center gap-0.5",
          layout.mac || layout.uchiwa ? "justify-center" : "justify-self-start",
        ]}
      >
        {#if device.showLauncherButton && device.features.launcher}
          <EditSpot id="launcher" label={$t("edit.spots.launcher")} placement={layout.spotPlacement} onmenu={layout.extend}>
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

          {#if device.dockSeparators && !layout.uchiwa}
            <div class="mx-1.5 h-6 w-px bg-base-content/10"></div>
          {/if}
        {/if}

        {#if !layout.uchiwa}
          <AppsStrip {layout} list={layout.rightShown} offset={0} tail={true} />
        {/if}
      </div>

      <div
        class={[
          "flex items-center",
          layout.uchiwa ? "justify-between gap-1" : "justify-self-end",
        ]}
      >
        {#if layout.uchiwa}
          <AppsStrip {layout} list={layout.rightShown} offset={layout.half} tail={true} />
        {/if}

        <div class="flex items-center" bind:clientWidth={layout.trailWidth}>
          {#if device.dockSeparators}
            <div class="mx-1.5 h-6 w-px bg-base-content/10"></div>
          {/if}

          <EditSpot id="tray" label={$t("edit.spots.tray")} placement={layout.spotPlacement} align="end" onmenu={layout.extend}>
            {#snippet options()}
              <EditOptions {layout} kind="tray" />
            {/snippet}

            <Tray {device} {panelOpen} {onclock} onmenu={layout.extend} />
          </EditSpot>
        </div>
      </div>

      <ContextMenu
        bind:open={barMenu}
        items={barMenuItems}
        x={barMenuX}
        bottom={device.dockHeight + 8}
        width={224}
        label={$t("dock.dockMenu")}
        onsize={height => layout.extend(barMenu ? height + 24 : 0)}
        onclose={() => layout.extend(0)}
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
