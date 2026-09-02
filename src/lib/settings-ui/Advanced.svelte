<script lang="ts">
  import { live } from "$lib/data/live.svelte"
  import { events, presets, todos } from "$lib/data/store"
  import { clearIconCache, openDataFolder } from "$lib/native"
  import {
    defaultAppearance,
    defaultDevice,
    defaultProfile,
    type DeviceSettings,
    type Profile,
  } from "$lib/settings"
  import Confirm from "./Confirm.svelte"
  import Row from "./Row.svelte"
  import Section from "./Section.svelte"
  import { toast } from "./toast.svelte"

  let {
    device = $bindable(),
    profile = $bindable(),
  }: { device: DeviceSettings; profile: Profile } = $props()

  const todoList = live(todos)
  const eventList = live(events)
  const presetList = live(presets)

  $effect(() => () => {
    todoList.stop()
    eventList.stop()
    presetList.stop()
  })

  const counts = $derived([
    { label: "Todos", value: todoList.items.length },
    { label: "Events", value: eventList.items.length },
    { label: "Presets", value: presetList.items.length },
  ])

  let confirming = $state(false)
  let clearing = $state(false)

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  const openFolder = async () => {
    try {
      await openDataFolder()
    } catch (error) {
      toast(`Data folder not opened: ${message(error)}`, "error")
    }
  }

  const clearIcons = async () => {
    clearing = true

    try {
      await clearIconCache()
      toast("Icon cache cleared", "success")
    } catch (error) {
      toast(`Icon cache not cleared: ${message(error)}`, "error")
    } finally {
      clearing = false
    }
  }

  const resetAppearance = () => {
    profile.appearance = { ...defaultAppearance }
    profile.presetId = defaultProfile.presetId
    toast("Appearance reset", "success")
  }

  const resetAll = () => {
    const {
      deviceId,
      deviceName,
      onboarded,
      autostart,
      pinnedApps,
      sync,
      dockMonitor,
    } = device

    device = {
      ...structuredClone(defaultDevice),
      deviceId,
      deviceName,
      onboarded,
      autostart,
      pinnedApps,
      sync,
      dockMonitor,
    }
    profile = structuredClone(defaultProfile)
    toast("Settings reset", "success")
  }
</script>

<Section title="Stored data" description="What Eris keeps on this device">
  <div data-row="Stored data" class="grid grid-cols-3 gap-3 px-4 py-3">
    {#each counts as c (c.label)}
      <div
        class="flex flex-col rounded-box border border-base-content/10 bg-base-100/40 px-3 py-2"
      >
        <span class="text-xs text-base-content/60">{c.label}</span>

        <span class="text-lg font-semibold tabular-nums">{c.value}</span>
      </div>
    {/each}
  </div>

  <Row label="Data folder" hint="Settings, todos, events, and cached icons">
    <button type="button" class="btn btn-soft btn-sm" onclick={openFolder}>
      Open
    </button>
  </Row>

  <Row label="Icon cache" hint="Rebuilt whenever an app icon is missing">
    <button
      type="button"
      class="btn btn-soft btn-sm"
      disabled={clearing}
      onclick={clearIcons}
    >
      {#if clearing}
        <span class="loading loading-spinner loading-xs"></span>
      {/if}

      Clear
    </button>
  </Row>
</Section>

<Section title="Resets">
  <Row label="Reset appearance" hint="Back to the default preset and sliders">
    <button type="button" class="btn btn-soft btn-sm" onclick={resetAppearance}>
      Reset
    </button>
  </Row>

  <Row
    label="Reset all settings"
    hint="Device name, sync, and stored data stay"
  >
    <button
      type="button"
      class="btn btn-error btn-sm"
      onclick={() => (confirming = true)}
    >
      Reset
    </button>
  </Row>
</Section>

<Confirm
  bind:open={confirming}
  title="Reset all settings?"
  body="Every setting goes back to its default. Todos, events, presets, and the sync connection stay."
  action="Reset"
  onconfirm={resetAll}
/>
