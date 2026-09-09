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
  import { t } from "svelte-i18n"

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
    { label: $t("settings.advanced.todos"), value: todoList.items.length },
    { label: $t("settings.advanced.events"), value: eventList.items.length },
    { label: $t("settings.advanced.presets"), value: presetList.items.length },
  ])

  let confirming = $state(false)
  let clearing = $state(false)

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  const openFolder = async () => {
    try {
      await openDataFolder()
    } catch (error) {
      toast($t("settings.toasts.dataFolderFailed", { values: { error: message(error) } }), "error")
    }
  }

  const clearIcons = async () => {
    clearing = true

    try {
      await clearIconCache()
      toast($t("settings.toasts.iconCacheCleared"), "success")
    } catch (error) {
      toast($t("settings.toasts.iconCacheFailed", { values: { error: message(error) } }), "error")
    } finally {
      clearing = false
    }
  }

  const resetAppearance = () => {
    profile.appearance = { ...defaultAppearance }
    profile.presetId = defaultProfile.presetId
    toast($t("settings.toasts.appearanceReset"), "success")
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
    toast($t("settings.toasts.settingsReset"), "success")
  }
</script>

<Section
  title={$t("settings.groups.storedData.title")}
  description={$t("settings.groups.storedData.description")}
>
  <div data-row={$t("settings.rows.storedData")} class="grid grid-cols-3 gap-3 px-4 py-3">
    {#each counts as c (c.label)}
      <div
        class="flex flex-col rounded-box border border-base-content/10 bg-base-100/40 px-3 py-2"
      >
        <span class="text-xs text-base-content/60">{c.label}</span>

        <span class="text-lg font-semibold tabular-nums">{c.value}</span>
      </div>
    {/each}
  </div>

  <Row label={$t("settings.rows.dataFolder")} hint={$t("settings.hints.dataFolder")}>
    <button type="button" class="btn btn-soft btn-sm" onclick={openFolder}>
      {$t("common.open")}
    </button>
  </Row>

  <Row label={$t("settings.rows.iconCache")} hint={$t("settings.hints.iconCache")}>
    <button
      type="button"
      class="btn btn-soft btn-sm"
      disabled={clearing}
      onclick={clearIcons}
    >
      {#if clearing}
        <span class="loading loading-spinner loading-xs"></span>
      {/if}

      {$t("common.clear")}
    </button>
  </Row>
</Section>

<Section title={$t("settings.groups.resets")}>
  <Row label={$t("settings.rows.resetAppearance")} hint={$t("settings.hints.resetAppearance")}>
    <button type="button" class="btn btn-soft btn-sm" onclick={resetAppearance}>
      {$t("common.reset")}
    </button>
  </Row>

  <Row label={$t("settings.rows.resetAll")} hint={$t("settings.hints.resetAll")}>
    <button
      type="button"
      class="btn btn-error btn-sm"
      onclick={() => (confirming = true)}
    >
      {$t("common.reset")}
    </button>
  </Row>
</Section>

<Confirm
  bind:open={confirming}
  title={$t("settings.advanced.resetAllTitle")}
  body={$t("settings.advanced.resetAllBody")}
  action={$t("common.reset")}
  onconfirm={resetAll}
/>
