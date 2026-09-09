<script lang="ts">
  import {
    installUsageBridge,
    listMonitors,
    type MonitorInfo,
    usageBridgeInstalled,
  } from "$lib/native"
  import { startEdit } from "$lib/edit/edit.svelte"
  import type { ClockAlign, DeviceSettings, DockAlign, DockStyle } from "$lib/settings"
  import DockPreview from "./DockPreview.svelte"
  import Row from "./Row.svelte"
  import Segmented from "./Segmented.svelte"
  import { t } from "svelte-i18n"

  let {
    device = $bindable(),
    subset = false,
  }: { device: DeviceSettings; subset?: boolean } = $props()

  const styles: DockStyle[] = ["windows", "mac"]

  const ALIGNMENTS: { value: DockAlign; icon: string }[] = [
    { value: "start", icon: "lucide:align-start-horizontal" },
    { value: "center", icon: "lucide:align-center-horizontal" },
    { value: "uchiwa", icon: "lucide:fan" },
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

  const CLOCK_ALIGNMENTS: { value: ClockAlign; icon: string }[] = [
    { value: "start", icon: "lucide:align-left" },
    { value: "center", icon: "lucide:align-center" },
    { value: "end", icon: "lucide:align-right" },
  ]

  const mac = $derived(device.dockStyle === "mac")

  const clockAlignments = $derived(
    CLOCK_ALIGNMENTS.map(a => ({
      ...a,
      label: $t(`settings.dock.align${a.value[0].toUpperCase()}${a.value.slice(1)}`),
    })),
  )

  const alignments = $derived(
    ALIGNMENTS.filter(a => !mac || a.value !== "start").map(a => ({
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

<div data-row={$t("settings.rows.style")} class="flex flex-col gap-3 px-4 py-3">
  <span class="text-sm font-medium">{$t("settings.rows.style")}</span>

  <div class="mx-auto w-full max-w-sm">
    <DockPreview {device} />
  </div>

  <div class="grid grid-cols-2 gap-3" role="radiogroup" aria-label={$t("settings.dock.styleAria")}>
    {#each styles as style (style)}
      {@const active = device.dockStyle === style}

      <button
        type="button"
        role="radio"
        aria-checked={active}
        class={[
          "flex flex-col gap-2 rounded-box border p-3 text-left outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-primary/50",
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
          {:else}
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
          {/if}
        </div>

        <span class="text-sm font-medium">{$t(`settings.dock.styles.${style}.label`)}</span>

        <span class="text-xs text-base-content/60">{$t(`settings.dock.styles.${style}.hint`)}</span>
      </button>
    {/each}
  </div>
</div>

{#if !subset}
  <Row label={$t("settings.rows.display")} hint={$t("settings.hints.display")}>
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

<Row label={$t("settings.rows.edge")} hint={$t("settings.hints.edge")}>
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
  <Row label={$t("settings.rows.spectrumStyle")} hint={$t("settings.hints.spectrumStyle")}>
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
  <Row label={$t("settings.rows.claudeUsageSide")} hint={$t("settings.hints.claudeUsageSide")}>
    <Segmented
      label={$t("settings.rows.claudeUsageSide")}
      bind:value={device.claudeUsageSide}
      options={[
        { value: "left", label: $t("settings.dock.left"), icon: "lucide:align-start-horizontal" },
        { value: "right", label: $t("settings.dock.right"), icon: "lucide:align-end-horizontal" },
      ]}
    />
  </Row>

  <Row label={$t("settings.rows.claudeBridge")} hint={$t("settings.hints.claudeBridge")}>
    <button
      class={["btn btn-sm", bridged ? "btn-ghost" : "btn-primary"]}
      disabled={bridging}
      onclick={toggleBridge}
    >
      {bridged ? $t("settings.dock.disconnect") : $t("settings.dock.connect")}
    </button>
  </Row>

  <Row label={$t("settings.rows.usageSnapshot")} hint={$t("settings.hints.usageSnapshot")} stacked>
    <input
      class="input input-sm w-full"
      type="text"
      placeholder="~/.claude/eris-usage.json"
      bind:value={device.claudeUsageSource}
    />
  </Row>
{/if}

{#if !subset}
  <Row label={$t("settings.rows.mediaSide")} hint={$t("settings.hints.mediaSide")}>
    <Segmented
      label={$t("settings.rows.mediaSide")}
      bind:value={device.mediaSide}
      options={[
        { value: "left", label: $t("settings.dock.left"), icon: "lucide:align-start-horizontal" },
        { value: "right", label: $t("settings.dock.right"), icon: "lucide:align-end-horizontal" },
      ]}
    />
  </Row>
{/if}

{#if !subset}
  <Row label={$t("settings.rows.alignment")} hint={$t("settings.hints.alignment")}>
    <Segmented label={$t("settings.rows.alignment")} bind:value={device.dockAlign} options={alignments} />
  </Row>
{/if}

{#if !subset}
  <Row label={$t("settings.rows.height")} value="{device.dockHeight} px" stacked>
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
    <Row label={$t("settings.rows.width")} value="{device.dockWidth} px" stacked>
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

  <Row label={$t("settings.rows.iconSize")} value="{device.dockIconSize} px" stacked>
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
  <Row label={$t("settings.rows.pinDesktop")} hint={$t("settings.hints.pinDesktop")}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.pinDesktop")}
      bind:checked={device.dockDesktop}
    />
  </Row>
{/if}

<Row label={$t("settings.rows.autoHide")} hint={$t("settings.hints.autoHide")}>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label={$t("settings.rows.autoHide")}
    bind:checked={device.dockAutoHide}
  />
</Row>

<Row label={$t("settings.rows.hideTaskbar")} hint={$t("settings.hints.hideTaskbar")}>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label={$t("settings.rows.hideTaskbar")}
    bind:checked={device.hideSystemTaskbar}
  />
</Row>

{#if !subset}
  <Row label={$t("settings.rows.clockAlign")} hint={$t("settings.hints.clockAlign")}>
    <Segmented
      label={$t("settings.rows.clockAlign")}
      bind:value={device.clockAlign}
      options={clockAlignments}
    />
  </Row>

  <Row label={$t("settings.rows.editMode")} hint={$t("settings.hints.editMode")} tag="experimental">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        disabled={!device.editMode}
        onclick={startEdit}
      >
        {$t("settings.dock.openEditMode")}
      </button>

      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.editMode")}
        bind:checked={device.editMode}
      />
    </div>
  </Row>

  {#each toggles as toggle (toggle)}
    <Row
      label={$t(`settings.rows.${toggle}`)}
      hint={$t(`settings.hints.${toggle}`)}
      tag={toggle === "showNetwork" ? "partial" : undefined}
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
