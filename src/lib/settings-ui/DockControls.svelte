<script lang="ts">
  import { listMonitors, type MonitorInfo } from "$lib/native"
  import type { DeviceSettings, DockStyle } from "$lib/settings"
  import Row from "./Row.svelte"
  import Segmented from "./Segmented.svelte"

  let {
    device = $bindable(),
    subset = false,
  }: { device: DeviceSettings; subset?: boolean } = $props()

  const styles: { value: DockStyle; label: string; hint: string }[] = [
    { value: "windows", label: "Windows", hint: "Full-width bar on the edge" },
    { value: "mac", label: "Mac", hint: "Floating centered dock" },
  ]

  type ToggleKey =
    | "showRunningApps"
    | "showBattery"
    | "showVolume"
    | "showMedia"
    | "showMeters"
    | "showNetwork"
    | "clock24h"
    | "showSeconds"

  const toggles: { key: ToggleKey; label: string; hint: string }[] =
    [
      {
        key: "showRunningApps",
        label: "Show running apps",
        hint: "Open windows appear next to pinned apps",
      },
      { key: "showBattery", label: "Show battery", hint: "Only on laptops" },
      {
        key: "showVolume",
        label: "Show volume",
        hint: "Scroll over it to change the level",
      },
      {
        key: "showMedia",
        label: "Show media controls",
        hint: "Play, pause, and skip the current track",
      },
      {
        key: "showMeters",
        label: "Show CPU and memory",
        hint: "Live usage readout",
      },
      {
        key: "showNetwork",
        label: "Show network",
        hint: "Wi-Fi or ethernet status",
      },
      { key: "clock24h", label: "24-hour clock", hint: "18:30 instead of 6:30 PM" },
      { key: "showSeconds", label: "Show seconds", hint: "Ticks once a second" },
    ]

  const mac = $derived(device.dockStyle === "mac")

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

  const describe = (m: MonitorInfo) =>
    `${m.name} (${m.primary ? "Primary, " : ""}${m.width}×${m.height})`

  const unplugged = $derived(
    device.dockMonitor !== null &&
      monitors.length > 0 &&
      !monitors.some(m => m.id === device.dockMonitor),
  )
</script>

<svelte:window onfocus={loadMonitors} />

<div data-row="Style" class="flex flex-col gap-3 px-4 py-3">
  <span class="text-sm font-medium">Style</span>

  <div class="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Dock style">
    {#each styles as s (s.value)}
      {@const active = device.dockStyle === s.value}

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
        onclick={() => (device.dockStyle = s.value)}
      >
        <div
          class="relative h-14 w-full overflow-hidden rounded-field bg-linear-to-br from-primary/20 to-secondary/20 ring-1 ring-base-content/10"
        >
          {#if s.value === "windows"}
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

        <span class="text-sm font-medium">{s.label}</span>

        <span class="text-xs text-base-content/60">{s.hint}</span>
      </button>
    {/each}
  </div>
</div>

{#if !subset}
  <Row label="Display" hint="Screen the dock sits on">
    <select
      class="select select-sm w-56"
      aria-label="Display"
      bind:value={device.dockMonitor}
    >
      <option value={null}>Automatic (primary)</option>

      {#each monitors as m (m.id)}
        <option value={m.id}>{describe(m)}</option>
      {/each}

      {#if unplugged}
        <option value={device.dockMonitor} disabled>Not connected</option>
      {/if}
    </select>
  </Row>
{/if}

<Row label="Edge" hint="Screen edge the dock sits on">
  <Segmented
    label="Edge"
    bind:value={device.dockEdge}
    options={[
      { value: "bottom", label: "Bottom", icon: "lucide:panel-bottom" },
      { value: "top", label: "Top", icon: "lucide:panel-top" },
    ]}
  />
</Row>

{#if !subset && !mac}
  <Row label="Alignment" hint="Where the apps sit along the bar">
    <Segmented
      label="Alignment"
      bind:value={device.dockAlign}
      options={[
        { value: "start", label: "Start", icon: "lucide:align-start-horizontal" },
        { value: "center", label: "Center", icon: "lucide:align-center-horizontal" },
      ]}
    />
  </Row>
{/if}

{#if !subset}
  <Row label="Height" value="{device.dockHeight} px" stacked>
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min="32"
      max="88"
      step="2"
      aria-label="Height"
      bind:value={device.dockHeight}
    />
  </Row>

  {#if mac}
    <Row label="Width" value="{device.dockWidth} px" stacked>
      <input
        type="range"
        class="range range-primary range-xs w-full"
        min="320"
        max="1400"
        step="20"
        aria-label="Width"
        bind:value={device.dockWidth}
      />
    </Row>
  {/if}

  <Row label="Icon size" value="{device.dockIconSize} px" stacked>
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min="16"
      max="32"
      step="2"
      aria-label="Icon size"
      bind:value={device.dockIconSize}
    />
  </Row>
{/if}

<Row label="Auto-hide" hint="Slides away until the cursor touches the edge">
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label="Auto-hide"
    bind:checked={device.dockAutoHide}
  />
</Row>

<Row label="Hide Windows taskbar" hint="Eris takes over the edge">
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label="Hide Windows taskbar"
    bind:checked={device.hideSystemTaskbar}
  />
</Row>

{#if !subset}
  {#each toggles as t (t.key)}
    <Row label={t.label} hint={t.hint}>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={t.label}
        bind:checked={device[t.key]}
      />
    </Row>
  {/each}
{/if}
