<script lang="ts">
  import { listMonitors, type MonitorInfo } from "$lib/native/windows"
  import { installUsageBridge, usageBridgeInstalled } from "$lib/native/usage"
  import { startEdit } from "$lib/edit"
  import {
    type ClockAlign,
    type DeviceSettings,
    type DockAlign,
    type DockStyle,
    defaultDevice,
  } from "@eris/settings"
  import Icon from "@iconify/svelte"
  import DockPreview from "./DockPreview.svelte"
  import { reset } from "./reset"
  import { Row, Segmented } from "@eris/ui"
  import { t } from "svelte-i18n"

  let {
    device = $bindable(),
    subset = false,
  }: { device: DeviceSettings; subset?: boolean } = $props()

  const resetRow = reset(() => device, defaultDevice)

  const styles: DockStyle[] = ["windows", "mac", "uchiwa"]

  const ALIGNMENTS: { value: DockAlign; icon: string }[] = [
    { value: "start", icon: "lucide:align-start-horizontal" },
    { value: "center", icon: "lucide:align-center-horizontal" },
  ]

  type ToggleKey =
    | "showLauncherButton"
    | "showRunningApps"
    | "dockSeparators"
    | "showTrayIcons"
    | "showKeymap"
    | "showClaudeUsage"
    | "claudeUsageStacked"
    | "showSettingsButton"
    | "showSpectrum"
    | "showBattery"
    | "showVolume"
    | "showMedia"
    | "showMeters"
    | "showNetwork"
    | "clock24h"
    | "showSeconds"

  const toggles: ToggleKey[] = [
    "showLauncherButton",
    "showRunningApps",
    "dockSeparators",
    "showTrayIcons",
    "showClaudeUsage",
    "claudeUsageStacked",
    "showSettingsButton",
    "showKeymap",
    "showBattery",
    "showVolume",
    "showMedia",
    "showSpectrum",
    "showMeters",
    "showNetwork",
    "clock24h",
    "showSeconds",
  ]

  const toggleVisible = (key: ToggleKey): boolean => {
    switch (key) {
      case "showLauncherButton":
        return device.features.launcher
      case "showClaudeUsage":
      case "claudeUsageStacked":
        return device.features.chat
      case "showSpectrum":
        return device.showMedia
      case "dockSeparators":
        return !uchiwa
      default:
        return true
    }
  }

  const CLOCK_ALIGNMENTS: { value: ClockAlign; icon: string }[] = [
    { value: "start", icon: "lucide:align-left" },
    { value: "center", icon: "lucide:align-center" },
    { value: "end", icon: "lucide:align-right" },
  ]

  const mac = $derived(device.dockStyle === "mac")
  const uchiwa = $derived(device.dockStyle === "uchiwa")
  const floating = $derived(mac || uchiwa)

  const clockAlignments = $derived(
    CLOCK_ALIGNMENTS.map(a => ({
      ...a,
      label: $t(`settings.dock.align${a.value[0].toUpperCase()}${a.value.slice(1)}`),
    })),
  )

  const alignments = $derived(
    ALIGNMENTS.map(a => ({
      ...a,
      label: $t(`settings.dock.${a.value}`),
    })),
  )

  let monitors = $state<MonitorInfo[]>([])

  const loadMonitors = () => {
    if (subset) {
      return
    }

    listMonitors()
      .then(list => {
        monitors = list
      })
      .catch(() => undefined)
  }

  $effect(() => {
    loadMonitors()
  })

  let bridged = $state(false)
  let bridging = $state(false)

  const readBridge = () => {
    usageBridgeInstalled()
      .then(value => {
        bridged = value
      })
      .catch(() => undefined)
  }

  $effect(() => {
    readBridge()
  })

  const toggleBridge = async () => {
    bridging = true
    await installUsageBridge(!bridged).catch(() => undefined)
    readBridge()
    bridging = false
  }

  const describe = (m: MonitorInfo) =>
    `${m.name} (${m.primary ? `${$t("settings.dock.primary")}, ` : ""}${m.width}×${m.height})`

  const unplugged = $derived(
    device.dockMonitor !== null &&
      monitors.length > 0 &&
      !monitors.some(m => m.id === device.dockMonitor),
  )
</script>

<svelte:window onfocus={loadMonitors} />

<div data-row={$t("settings.rows.style")} class="group/row flex flex-col gap-3 px-4 py-3">
  <span class="flex items-center gap-1.5 text-sm font-medium">
    {$t("settings.rows.style")}

    <button
      type="button"
      class="btn btn-ghost btn-circle btn-xs opacity-0 transition-opacity duration-100 group-hover/row:opacity-60 hover:opacity-100 focus-visible:opacity-100"
      aria-label={$t("common.reset")}
      title={$t("common.reset")}
      onclick={resetRow("dockStyle")}
    >
      <Icon icon="lucide:rotate-ccw" class="size-3.5" />
    </button>
  </span>

  <div class="mx-auto w-full max-w-sm">
    <DockPreview {device} />
  </div>

  <div class="grid grid-cols-3 gap-3" role="radiogroup" aria-label={$t("settings.dock.styleAria")}>
    {#each styles as style (style)}
      {@const active = device.dockStyle === style}

      <button
        type="button"
        role="radio"
        aria-checked={active}
        class={[
          "flex flex-col gap-2 rounded-box border p-3 text-left outline-none transition duration-100 focus-visible:ring-2 focus-visible:ring-primary/50",
          active
            ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
            : "border-base-content/10 bg-base-100/40 hover:bg-base-content/5",
        ]}
        onclick={() => (device.dockStyle = style)}
      >
        <div
          class="relative h-14 w-full overflow-hidden rounded-field bg-linear-to-br from-primary/20 to-secondary/20 ring-1 ring-base-content/10"
        >
          {#if style === "windows"}
            <div
              class={[
                "absolute inset-x-0 flex h-3.5 items-center justify-center gap-1 bg-base-content/25",
                device.dockEdge === "top" ? "top-0" : "bottom-0",
              ]}
            >
              {#each [0, 1, 2, 3] as dot (dot)}
                <span class="size-1.5 rounded-sm bg-base-100/80"></span>
              {/each}
            </div>
          {:else if style === "mac"}
            <div
              class={[
                "absolute left-1/2 flex h-3.5 w-1/2 -translate-x-1/2 items-center justify-center gap-1 rounded-full bg-base-content/25",
                device.dockEdge === "top" ? "top-1" : "bottom-1",
              ]}
            >
              {#each [0, 1, 2, 3] as dot (dot)}
                <span class="size-1.5 rounded-full bg-base-100/80"></span>
              {/each}
            </div>
          {:else}
            <div
              class={[
                "absolute left-1/2 flex h-5 w-3/4 -translate-x-1/2 items-end justify-center rounded-full bg-base-content/25",
                device.dockEdge === "top" ? "top-1" : "bottom-1",
              ]}
            >
              {#each [-2, -1, 0, 1, 2] as slot (slot)}
                <span
                  class="absolute bottom-1 left-1/2 size-1.5 rounded-full bg-base-100/80"
                  style:transform="translateX(-50%) rotate({slot * 22}deg) translateY(-0.55rem)"
                  style:transform-origin="50% 0.55rem"
                  style:bottom="-0.4rem"
                ></span>
              {/each}
            </div>
          {/if}
        </div>

        <span class="text-sm font-medium">{$t(`settings.dock.styles.${style}.label`)}</span>

        <span class="text-xs text-base-content/60">{$t(`settings.dock.styles.${style}.hint`)}</span>
      </button>
    {/each}
  </div>
</div>

{#if !subset}
  <Row
    label={$t("settings.rows.display")}
    hint={$t("settings.hints.display")}
    onreset={resetRow("dockMonitor")}
  >
    <select
      class="select select-sm w-56"
      aria-label={$t("settings.rows.display")}
      bind:value={device.dockMonitor}
    >
      <option value={null}>{$t("settings.dock.automatic")}</option>

      {#each monitors as m (m.id)}
        <option value={m.id}>{describe(m)}</option>
      {/each}

      {#if unplugged}
        <option value={device.dockMonitor} disabled>{$t("settings.dock.notConnected")}</option>
      {/if}
    </select>
  </Row>
{/if}

<Row
  label={$t("settings.rows.edge")}
  hint={$t("settings.hints.edge")}
  onreset={resetRow("dockEdge")}
>
  <Segmented
    label={$t("settings.rows.edge")}
    bind:value={device.dockEdge}
    options={[
      { value: "bottom", label: $t("settings.dock.bottom"), icon: "lucide:panel-bottom" },
      { value: "top", label: $t("settings.dock.top"), icon: "lucide:panel-top" },
    ]}
  />
</Row>

{#if !subset && device.showSpectrum}
  <Row
    label={$t("settings.rows.spectrumStyle")}
    hint={$t("settings.hints.spectrumStyle")}
    onreset={resetRow("spectrumStyle")}
  >
    <Segmented
      label={$t("settings.rows.spectrumStyle")}
      bind:value={device.spectrumStyle}
      options={[
        { value: "bars", label: $t("settings.dock.bars") },
        { value: "mirror", label: $t("settings.dock.mirror") },
        { value: "wave", label: $t("settings.dock.wave") },
        { value: "dots", label: $t("settings.dock.dots") },
      ]}
    />
  </Row>
{/if}

{#if !subset}
  <Row label={$t("settings.rows.claudeBridge")} hint={$t("settings.hints.claudeBridge")}>
    <button
      class={["btn btn-sm", bridged ? "btn-ghost" : "btn-primary"]}
      disabled={bridging}
      onclick={toggleBridge}
    >
      {bridged ? $t("settings.dock.disconnect") : $t("settings.dock.connect")}
    </button>
  </Row>

  {#if !bridged}
    <Row
      label={$t("settings.rows.usageSnapshot")}
      hint={$t("settings.hints.usageSnapshot")}
      stacked
      onreset={resetRow("claudeUsageSource")}
    >
      <input
        class="input input-sm w-full"
        type="text"
        placeholder="~/.claude/eris-usage.json"
        bind:value={device.claudeUsageSource}
      />
    </Row>
  {/if}
{/if}

{#if !subset}
  <Row
    label={$t("settings.rows.mediaSide")}
    hint={$t("settings.hints.mediaSide")}
    onreset={resetRow("mediaSide")}
  >
    <Segmented
      label={$t("settings.rows.mediaSide")}
      bind:value={device.mediaSide}
      options={[
        { value: "left", label: $t("settings.dock.left"), icon: "lucide:align-start-horizontal" },
        { value: "right", label: $t("settings.dock.right"), icon: "lucide:align-end-horizontal" },
      ]}
    />
  </Row>

  {#if device.features.chat}
    <Row
      label={$t("settings.rows.claudeUsageSide")}
      hint={$t("settings.hints.claudeUsageSide")}
      onreset={resetRow("claudeUsageSide")}
    >
      <Segmented
        label={$t("settings.rows.claudeUsageSide")}
        bind:value={device.claudeUsageSide}
        options={[
          { value: "left", label: $t("settings.dock.left"), icon: "lucide:align-start-horizontal" },
          { value: "right", label: $t("settings.dock.right"), icon: "lucide:align-end-horizontal" },
        ]}
      />
    </Row>
  {/if}
{/if}

{#if !subset && !uchiwa}
  <Row
    label={$t("settings.rows.alignment")}
    hint={$t("settings.hints.alignment")}
    onreset={resetRow("dockAlign")}
  >
    <Segmented label={$t("settings.rows.alignment")} bind:value={device.dockAlign} options={alignments} />
  </Row>
{/if}

{#if !subset}
  <Row
    label={$t("settings.rows.height")}
    value="{device.dockHeight} px"
    stacked
    onreset={resetRow("dockHeight")}
  >
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min="32"
      max="88"
      step="2"
      aria-label={$t("settings.rows.height")}
      bind:value={device.dockHeight}
    />
  </Row>

  {#if mac}
    <Row
      label={$t("settings.rows.width")}
      value="{device.dockWidth} px"
      stacked
      onreset={resetRow("dockWidth")}
    >
      <input
        type="range"
        class="range range-primary range-xs w-full"
        min="320"
        max="1400"
        step="20"
        aria-label={$t("settings.rows.width")}
        bind:value={device.dockWidth}
      />
    </Row>
  {/if}

  <Row
    label={$t("settings.rows.iconSize")}
    value="{device.dockIconSize} px"
    stacked
    onreset={resetRow("dockIconSize")}
  >
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min="16"
      max="32"
      step="2"
      aria-label={$t("settings.rows.iconSize")}
      bind:value={device.dockIconSize}
    />
  </Row>
{/if}

{#if mac}
  <Row
    label={$t("settings.rows.pinDesktop")}
    hint={$t("settings.hints.pinDesktop")}
    onreset={resetRow("dockDesktop")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.pinDesktop")}
      bind:checked={device.dockDesktop}
    />
  </Row>
{/if}

<Row
  label={$t("settings.rows.autoHide")}
  hint={$t("settings.hints.autoHide")}
  onreset={resetRow("dockAutoHide")}
>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label={$t("settings.rows.autoHide")}
    bind:checked={device.dockAutoHide}
  />
</Row>

{#if device.dockAutoHide}
  <Row
    label={$t("settings.rows.hideAnimation")}
    hint={$t("settings.hints.hideAnimation")}
    onreset={resetRow("dockHideAnimation")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.hideAnimation")}
      bind:checked={device.dockHideAnimation}
    />
  </Row>
{/if}

<Row
  label={$t("settings.rows.hideTaskbar")}
  hint={$t("settings.hints.hideTaskbar")}
  onreset={resetRow("hideSystemTaskbar")}
>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label={$t("settings.rows.hideTaskbar")}
    bind:checked={device.hideSystemTaskbar}
  />
</Row>

{#if !subset}
  <Row
    label={$t("settings.rows.topBar")}
    hint={$t("settings.hints.topBar")}
    onreset={resetRow("topBar")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.topBar")}
      bind:checked={device.topBar}
    />
  </Row>

  <Row
    label={$t("settings.rows.panelPosition")}
    hint={$t("settings.hints.panelPosition")}
    onreset={resetRow("panelPosition")}
  >
    <Segmented
      label={$t("settings.rows.panelPosition")}
      bind:value={device.panelPosition}
      options={[
        { value: "left", label: $t("settings.dock.alignStart"), icon: "lucide:align-left" },
        { value: "center", label: $t("settings.dock.alignCenter"), icon: "lucide:align-center-horizontal" },
        { value: "right", label: $t("settings.dock.alignEnd"), icon: "lucide:align-right" },
      ]}
    />
  </Row>

  <Row
    label={$t("settings.rows.clockAlign")}
    hint={$t("settings.hints.clockAlign")}
    onreset={resetRow("clockAlign")}
  >
    <Segmented
      label={$t("settings.rows.clockAlign")}
      bind:value={device.clockAlign}
      options={clockAlignments}
    />
  </Row>

  <Row
    label={$t("settings.rows.dockLayout")}
    hint={$t("settings.hints.dockLayout")}
    onreset={resetRow("dockWidgets")}
  >
    <button
      type="button"
      class="btn btn-ghost btn-xs"
      disabled={!device.editMode}
      onclick={startEdit}
    >
      {$t("settings.dock.openEditMode")}
    </button>
  </Row>

  {#each toggles.filter(toggleVisible) as toggle (toggle)}
    <Row
      label={$t(`settings.rows.${toggle}`)}
      hint={$t(`settings.hints.${toggle}`)}
      tag={toggle === "showNetwork" ? "partial" : undefined}
      onreset={resetRow(toggle)}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t(`settings.rows.${toggle}`)}
        bind:checked={device[toggle]}
      />
    </Row>
  {/each}
{/if}
