<script lang="ts">
  import Icon from "@iconify/svelte"
  import {
    conform,
    events,
    isCalendarEvent,
    isNote,
    isPreset,
    isRecord,
    isTodo,
    notes,
    presets,
    saveProfileSynced,
    todos,
  } from "$lib/data"
  import {
    defaultAppearance,
    defaultDevice,
    defaultProfile,
    loadDevice,
    loadProfile,
    saveDevice,
  } from "@eris/settings"
  import { toast } from "@eris/ui"
  import { t } from "svelte-i18n"

  let busy = $state(false)
  let picker = $state<HTMLInputElement>()

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  const bundle = async () => ({
    app: "eris",
    version: 1,
    exportedAt: new Date().toISOString(),
    device: await loadDevice(),
    profile: await loadProfile(),
    presets: await presets.all(),
    todos: await todos.all(),
    events: await events.all(),
    notes: await notes.all(),
  })

  const download = async () => {
    busy = true

    try {
      const json = JSON.stringify(await bundle(), null, 2)
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      )
      const link = document.createElement("a")

      link.href = url
      link.download = `eris-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast($t("settings.backup.exportStarted"), "success")
    } catch (error) {
      toast(message(error), "error")
    } finally {
      busy = false
    }
  }

  const copy = async () => {
    busy = true

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(await bundle(), null, 2),
      )
      toast($t("settings.backup.copied"), "success")
    } catch (error) {
      toast(message(error), "error")
    } finally {
      busy = false
    }
  }

  const importBundle = async (data: Record<string, unknown>) => {
    let count = 0
    let skipped = 0

    const valid = <T,>(value: unknown, check: (item: unknown) => item is T) => {
      const list: unknown[] = Array.isArray(value) ? value : []
      const kept = list.filter(check)

      skipped += list.length - kept.length

      return kept
    }

    if (isRecord(data.device)) {
      const current = await loadDevice()

      await saveDevice({
        ...conform(defaultDevice, data.device),
        deviceId: current.deviceId,
        deviceName: current.deviceName,
        onboarded: current.onboarded,
      })
      count += 1
    }

    if (isRecord(data.profile)) {
      await saveProfileSynced(conform(defaultProfile, data.profile))
      count += 1
    }

    for (const item of valid(data.presets, isPreset)) {
      await presets.put({
        ...item,
        appearance: conform(defaultAppearance, item.appearance),
      })
      count += 1
    }

    for (const item of valid(data.todos, isTodo)) {
      await todos.put(item)
      count += 1
    }

    for (const item of valid(data.events, isCalendarEvent)) {
      await events.put(item)
      count += 1
    }

    for (const item of valid(data.notes, isNote)) {
      await notes.put(item)
      count += 1
    }

    return { count, skipped }
  }

  const onpick = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]

    input.value = ""

    if (!file) {
      return
    }

    busy = true

    try {
      const data: unknown = JSON.parse(await file.text())

      if (!isRecord(data)) {
        throw new Error($t("settings.backup.notBackup"))
      }

      const { count, skipped } = await importBundle(data)

      toast(
        count === 0
          ? $t("settings.backup.nothing")
          : $t("settings.backup.imported", { values: { count } }),
        count === 0 ? "info" : "success",
      )

      if (skipped > 0) {
        toast($t("settings.backup.skipped", { values: { count: skipped } }), "error")
      }
    } catch (error) {
      toast(message(error), "error")
    } finally {
      busy = false
    }
  }
</script>

<div data-row={$t("settings.rows.backup")} class="flex flex-wrap items-center gap-2 px-4 py-3">
  <button type="button" class="btn btn-soft btn-sm" disabled={busy} onclick={download}>
    <Icon icon="lucide:download" class="size-4" />
    {$t("settings.backup.exportJson")}
  </button>

  <button type="button" class="btn btn-ghost btn-sm" disabled={busy} onclick={copy}>
    <Icon icon="lucide:clipboard-copy" class="size-4" />
    {$t("settings.backup.copyJson")}
  </button>

  <span class="grow"></span>

  <button
    type="button"
    class="btn btn-soft btn-sm"
    disabled={busy}
    onclick={() => picker?.click()}
  >
    {#if busy}
      <span class="loading loading-spinner loading-xs"></span>
    {:else}
      <Icon icon="lucide:upload" class="size-4" />
    {/if}
    {$t("settings.backup.importJson")}
  </button>

  <input
    bind:this={picker}
    type="file"
    accept="application/json,.json"
    class="hidden"
    onchange={onpick}
  />
</div>
