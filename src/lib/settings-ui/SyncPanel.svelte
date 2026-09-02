<script lang="ts">
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import { type DeviceSettings, saveDevice } from "$lib/settings"
  import {
    forgetDevice,
    listDevices,
    resetFromServer,
    resetServer,
    syncNow,
    testConnection,
    unlinkDevice,
  } from "$lib/sync/engine"
  import {
    type DeviceInfo,
    type HealthResponse,
    type SyncedCollection,
    syncedCollections,
  } from "$lib/sync/protocol"
  import { syncStatus } from "$lib/sync/status.svelte"
  import Confirm from "./Confirm.svelte"
  import Row from "./Row.svelte"
  import Section from "./Section.svelte"
  import { toast } from "./toast.svelte"

  let {
    device = $bindable(),
    compact = false,
  }: { device: DeviceSettings; compact?: boolean } = $props()

  const collectionLabels: Record<SyncedCollection, string> = {
    todos: "Todos",
    events: "Events",
    profile: "Profile",
    presets: "Presets",
    notes: "Notes",
  }

  const collectionList = new Intl.ListFormat("en").format(
    syncedCollections.map(name => collectionLabels[name].toLowerCase()),
  )

  const intervals = [1, 5, 15, 60]

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  const configured = $derived(
    device.sync.url.trim() !== "" && device.sync.token.trim() !== "",
  )

  let showToken = $state(false)
  let testing = $state(false)
  let health = $state<HealthResponse | null>(null)
  let testError = $state("")
  let syncing = $state(false)
  let busy = $state(false)
  let devices = $state<DeviceInfo[]>([])
  let devicesError = $state("")
  let confirmReplace = $state(false)
  let confirmReset = $state(false)
  let confirmUnlink = $state(false)
  let resetCollection = $state<SyncedCollection>("todos")
  let now = $state(Date.now())

  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000)

    return () => clearInterval(timer)
  })

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  const relative = (at: number) => {
    const seconds = Math.round((at - now) / 1000)

    if (Math.abs(seconds) < 60) {
      return "just now"
    }

    const minutes = Math.round(seconds / 60)

    if (Math.abs(minutes) < 60) {
      return rtf.format(minutes, "minute")
    }

    const hours = Math.round(minutes / 60)

    if (Math.abs(hours) < 24) {
      return rtf.format(hours, "hour")
    }

    return rtf.format(Math.round(hours / 24), "day")
  }

  const flush = () => saveDevice($state.snapshot(device))

  const refreshDevices = async () => {
    if (!configured) {
      devices = []

      return
    }

    try {
      devices = await listDevices()
      devicesError = ""
    } catch (error) {
      devicesError = message(error)
    }
  }

  $effect(() => {
    if (!compact) {
      untrack(refreshDevices)
    }
  })

  const test = async () => {
    testing = true
    health = null
    testError = ""

    try {
      health = await testConnection(
        device.sync.url.trim(),
        device.sync.token.trim(),
      )
      await flush()
      await refreshDevices()
    } catch (error) {
      testError = message(error)
    } finally {
      testing = false
    }
  }

  const sync = async () => {
    syncing = true

    try {
      await flush()

      const result = await syncNow()

      if (syncStatus.state === "error") {
        toast(syncStatus.lastError ?? "Sync failed", "error")
      } else if (syncStatus.state === "disabled") {
        toast("Enable sync and fill in the server first", "info")
      } else {
        toast(
          `Synced: ${result.pushed} pushed, ${result.pulled} pulled`,
          "success",
        )
      }

      await refreshDevices()
    } finally {
      syncing = false
    }
  }

  const forget = async (id: string) => {
    try {
      await forgetDevice(id)
      devices = devices.filter(d => d.id !== id)
      toast("Device forgotten", "success")
    } catch (error) {
      toast(message(error), "error")
    }
  }

  const guarded = async (task: () => Promise<void>, done: string) => {
    busy = true

    try {
      await flush()
      await task()
      toast(done, "success")
      await refreshDevices()
    } catch (error) {
      toast(message(error), "error")
    } finally {
      busy = false
    }
  }

  const replaceLocal = () =>
    guarded(resetFromServer, "Local data replaced from the server")

  const resetRemote = () =>
    guarded(async () => {
      const result = await resetServer(resetCollection)

      toast(`${result.tombstoned} records cleared`, "info")
    }, `${collectionLabels[resetCollection]} reset on the server`)

  const unlink = () =>
    guarded(async () => {
      await unlinkDevice()
      devices = []
      health = null
    }, "Device unlinked")

  const stateLabel = $derived(
    {
      idle: "Up to date",
      syncing: "Syncing",
      error: "Error",
      disabled: "Off",
    }[syncStatus.state],
  )
</script>

<Section
  title="Server"
  description="Keeps {collectionList} in step across devices."
>
  <Row label="Server URL" hint="Where the Eris sync server runs" stacked>
    <input
      class="input input-sm w-full"
      type="url"
      placeholder="https://sync.example.com"
      aria-label="Server URL"
      autocomplete="off"
      spellcheck="false"
      bind:value={device.sync.url}
    />
  </Row>

  <Row label="Token" hint="The ERIS_TOKEN the server was started with" stacked>
    <div class="join w-full">
      <input
        class="input input-sm join-item w-full"
        type={showToken ? "text" : "password"}
        placeholder="Token"
        aria-label="Token"
        autocomplete="off"
        spellcheck="false"
        value={device.sync.token}
        oninput={e => (device.sync.token = e.currentTarget.value)}
      />

      <button
        type="button"
        class="btn btn-sm join-item"
        aria-label={showToken ? "Hide token" : "Reveal token"}
        onclick={() => (showToken = !showToken)}
      >
        <Icon icon={showToken ? "lucide:eye-off" : "lucide:eye"} class="size-4" />
      </button>
    </div>
  </Row>

  <div class="flex flex-wrap items-center gap-3 px-4 py-3">
    <button
      type="button"
      class="btn btn-soft btn-sm"
      disabled={!configured || testing}
      onclick={test}
    >
      {#if testing}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <Icon icon="lucide:plug-zap" class="size-4" />
      {/if}
      Test connection
    </button>

    {#if health}
      <span class="flex items-center gap-1 text-xs text-success">
        <Icon icon="lucide:check" class="size-3.5" />
        Connected, server {health.version}, seq {health.seq}
      </span>
    {:else if testError}
      <span class="text-xs text-error">{testError}</span>
    {/if}
  </div>

  <Row label="Enable sync" hint="Runs in the background while Eris is open">
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label="Enable sync"
      bind:checked={device.sync.enabled}
    />
  </Row>

  {#if !compact}
    <Row label="Interval" hint="How often to check the server">
      <select
        class="select select-sm w-32"
        aria-label="Interval"
        bind:value={device.sync.intervalMinutes}
      >
        {#each intervals as minutes (minutes)}
          <option value={minutes}>
            {minutes === 60 ? "Every hour" : `Every ${minutes} min`}
          </option>
        {/each}
      </select>
    </Row>

    <Row label="Collections" hint="What this device sends and receives" stacked>
      <div class="flex flex-wrap gap-2">
        {#each syncedCollections as name (name)}
          <label
            class="flex cursor-pointer items-center gap-2 rounded-field border border-base-content/10 bg-base-100/40 px-3 py-1.5 text-sm"
          >
            <input
              type="checkbox"
              class="checkbox checkbox-primary checkbox-xs"
              bind:checked={device.sync.collections[name]}
            />
            {collectionLabels[name]}
          </label>
        {/each}
      </div>
    </Row>
  {/if}
</Section>

{#if !compact}
  <Section title="Status">
    <div class="flex items-center justify-between gap-4 px-4 py-3">
      <div class="flex min-w-0 flex-col gap-1">
        <div class="flex items-center gap-2 text-sm">
          <span
            class={[
              "badge badge-sm",
              syncStatus.state === "idle" && "badge-success",
              syncStatus.state === "syncing" && "badge-info",
              syncStatus.state === "error" && "badge-error",
              syncStatus.state === "disabled" && "badge-ghost",
            ]}
          >
            {stateLabel}
          </span>

          <span class="text-base-content/70">
            {syncStatus.lastSyncAt
              ? `Last sync ${relative(syncStatus.lastSyncAt)}`
              : "Never synced"}
          </span>

          {#if syncStatus.pending > 0}
            <span class="text-base-content/70 tabular-nums">
              {syncStatus.pending} pending
            </span>
          {/if}
        </div>

        {#if syncStatus.lastError}
          <span class="truncate text-xs text-error">{syncStatus.lastError}</span>
        {/if}
      </div>

      <button
        type="button"
        class="btn btn-primary btn-sm"
        disabled={syncing || syncStatus.state === "syncing"}
        onclick={sync}
      >
        {#if syncing || syncStatus.state === "syncing"}
          <span class="loading loading-spinner loading-xs"></span>
        {:else}
          <Icon icon="lucide:refresh-cw" class="size-4" />
        {/if}
        Sync now
      </button>
    </div>
  </Section>

  <Section title="Devices" description="Everything registered with this server">
    {#if devicesError}
      <p class="px-4 py-3 text-xs text-error">{devicesError}</p>
    {:else if devices.length === 0}
      <p class="px-4 py-3 text-sm text-base-content/60">
        {configured ? "No devices yet" : "Set a server URL and token first"}
      </p>
    {:else}
      {#each devices as d (d.id)}
        {@const own = d.id === device.deviceId}

        <div class="flex items-center justify-between gap-3 px-4 py-2.5">
          <div class="flex min-w-0 items-center gap-2">
            <Icon
              icon={own ? "lucide:laptop" : "lucide:monitor"}
              class="size-4 shrink-0 text-base-content/60"
            />

            <div class="flex min-w-0 flex-col">
              <span class="truncate text-sm">{d.name || d.id}</span>

              <span class="text-xs text-base-content/60">
                Seen {relative(d.lastSeen)}
              </span>
            </div>

            {#if own}
              <span class="badge badge-primary badge-soft badge-xs">This device</span>
            {/if}
          </div>

          {#if !own}
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onclick={() => forget(d.id)}
            >
              Forget
            </button>
          {/if}
        </div>
      {/each}
    {/if}
  </Section>

  <Section title="Danger zone" description="These cannot be undone">
    <Row
      label="Replace local data with server"
      hint="Drops local {collectionList} and pulls everything again"
    >
      <button
        type="button"
        class="btn btn-outline btn-error btn-sm"
        disabled={!configured || busy}
        onclick={() => (confirmReplace = true)}
      >
        Replace
      </button>
    </Row>

    <Row
      label="Reset collection on server"
      hint="Marks every record deleted so all devices clear it"
    >
      <div class="join">
        <select
          class="select select-sm join-item w-28"
          aria-label="Collection"
          bind:value={resetCollection}
        >
          {#each syncedCollections as name (name)}
            <option value={name}>{collectionLabels[name]}</option>
          {/each}
        </select>

        <button
          type="button"
          class="btn btn-outline btn-error btn-sm join-item"
          disabled={!configured || busy}
          onclick={() => (confirmReset = true)}
        >
          Reset
        </button>
      </div>
    </Row>

    <Row
      label="Unlink this device"
      hint="Forgets the server, token, and pending changes on this device"
    >
      <button
        type="button"
        class="btn btn-outline btn-error btn-sm"
        disabled={busy}
        onclick={() => (confirmUnlink = true)}
      >
        Unlink
      </button>
    </Row>
  </Section>

  <Confirm
    bind:open={confirmReplace}
    title="Replace local data?"
    body="Local {collectionList} are deleted and replaced with what the server has. Unsynced changes are lost."
    action="Replace"
    onconfirm={replaceLocal}
  />

  <Confirm
    bind:open={confirmReset}
    title="Reset {collectionLabels[resetCollection]} on the server?"
    body="Every record in this collection is marked deleted on the server and removed from all synced devices."
    action="Reset"
    onconfirm={resetRemote}
  />

  <Confirm
    bind:open={confirmUnlink}
    title="Unlink this device?"
    body="Sync is turned off and the server address, token, and pending changes are cleared. Local data stays."
    action="Unlink"
    onconfirm={unlink}
  />
{/if}
