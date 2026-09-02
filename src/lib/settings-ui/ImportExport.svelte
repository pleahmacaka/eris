<script lang="ts">
  import Icon from "@iconify/svelte"
  import {
    events,
    notes,
    presets,
    saveProfileSynced,
    todos,
  } from "$lib/data/store"
  import type { CalendarEvent, Note, Preset, Todo } from "$lib/data/types"
  import {
    defaultDevice,
    defaultProfile,
    defaultSync,
    loadDevice,
    loadProfile,
    saveDevice,
  } from "$lib/settings"
  import { toast } from "./toast.svelte"

  let busy = $state(false)
  let picker = $state<HTMLInputElement>()

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  const isRecord = (value: unknown): value is Record<string, any> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

  const records = (value: unknown) =>
    Array.isArray(value) ? value.filter(isRecord) : []

  const items = <T extends { id: string }>(value: unknown) =>
    records(value).filter(r => typeof r.id === "string") as T[]

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
      toast("Export started", "success")
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
      toast("JSON copied to the clipboard", "success")
    } catch (error) {
      toast(message(error), "error")
    } finally {
      busy = false
    }
  }

  const importBundle = async (data: Record<string, any>) => {
    let count = 0

    if (isRecord(data.device)) {
      const current = await loadDevice()

      await saveDevice({
        ...defaultDevice,
        ...data.device,
        sync: {
          ...defaultSync,
          ...data.device.sync,
          collections: {
            ...defaultSync.collections,
            ...data.device.sync?.collections,
          },
        },
        deviceId: current.deviceId,
        deviceName: current.deviceName,
        onboarded: current.onboarded,
      })
      count += 1
    }

    if (isRecord(data.profile)) {
      await saveProfileSynced({
        ...defaultProfile,
        ...data.profile,
        appearance: { ...defaultProfile.appearance, ...data.profile.appearance },
        launcher: { ...defaultProfile.launcher, ...data.profile.launcher },
        calendar: { ...defaultProfile.calendar, ...data.profile.calendar },
        todo: { ...defaultProfile.todo, ...data.profile.todo },
      })
      count += 1
    }

    for (const item of items<Preset>(data.presets)) {
      await presets.put(item)
      count += 1
    }

    for (const item of items<Todo>(data.todos)) {
      await todos.put(item)
      count += 1
    }

    for (const item of items<CalendarEvent>(data.events)) {
      await events.put(item)
      count += 1
    }

    for (const item of items<Note>(data.notes)) {
      await notes.put(item)
      count += 1
    }

    return count
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
        throw new Error("Not an Eris backup")
      }

      const count = await importBundle(data)

      toast(
        count === 0 ? "Nothing to import" : `Imported ${count} items`,
        count === 0 ? "info" : "success",
      )
    } catch (error) {
      toast(message(error), "error")
    } finally {
      busy = false
    }
  }
</script>

<div data-row="Backup" class="flex flex-wrap items-center gap-2 px-4 py-3">
  <button type="button" class="btn btn-soft btn-sm" disabled={busy} onclick={download}>
    <Icon icon="lucide:download" class="size-4" />
    Export JSON
  </button>

  <button type="button" class="btn btn-ghost btn-sm" disabled={busy} onclick={copy}>
    <Icon icon="lucide:clipboard-copy" class="size-4" />
    Copy JSON
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
    Import JSON
  </button>

  <input
    bind:this={picker}
    type="file"
    accept="application/json,.json"
    class="hidden"
    onchange={onpick}
  />
</div>
