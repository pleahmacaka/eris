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
  import { locale, t } from "svelte-i18n"

  let {
    device = $bindable(),
    compact = false,
  }: { device: DeviceSettings; compact?: boolean } = $props()

  const collectionLabel = (name: SyncedCollection) => $t(`settings.sync.collections.${name}`)

  const collectionList = $derived(
    new Intl.ListFormat($locale ?? "en").format(
      syncedCollections.map(name => collectionLabel(name).toLowerCase()),
    ),
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

  const rtf = $derived(new Intl.RelativeTimeFormat($locale ?? "en", { numeric: "auto" }))

  const relative = (at: number) => {
    const seconds = Math.round((at - now) / 1000)

    if (Math.abs(seconds) < 60) {
      return $t("settings.sync.justNow")
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
        toast(syncStatus.lastError ?? $t("settings.sync.toasts.failed"), "error")
      } else if (syncStatus.state === "disabled") {
        toast($t("settings.sync.toasts.enableFirst"), "info")
      } else {
        toast(
          $t("settings.sync.toasts.synced", {
            values: { pushed: result.pushed, pulled: result.pulled },
          }),
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
      toast($t("settings.sync.toasts.deviceForgotten"), "success")
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
    guarded(resetFromServer, $t("settings.sync.toasts.localReplaced"))

  const resetRemote = () =>
    guarded(
      async () => {
        const result = await resetServer(resetCollection)

        toast(
          $t("settings.sync.toasts.recordsCleared", { values: { count: result.tombstoned } }),
          "info",
        )
      },
      $t("settings.sync.toasts.collectionReset", {
        values: { collection: collectionLabel(resetCollection) },
      }),
    )

  const unlink = () =>
    guarded(async () => {
      await unlinkDevice()
      devices = []
      health = null
    }, $t("settings.sync.toasts.unlinked"))

  const stateLabel = $derived($t(`settings.sync.states.${syncStatus.state}`))
</script>

<Section
  title={$t("settings.sync.server.title")}
  description={$t("settings.sync.server.description", { values: { collections: collectionList } })}
>
  <Row label={$t("settings.rows.serverUrl")} hint={$t("settings.hints.serverUrl")} stacked>
    <input
      class="input input-sm w-full"
      type="url"
      placeholder="https://sync.example.com"
      aria-label={$t("settings.rows.serverUrl")}
      autocomplete="off"
      spellcheck="false"
      bind:value={device.sync.url}
    />
  </Row>

  <Row label={$t("settings.rows.token")} hint={$t("settings.hints.token")} stacked>
    <div class="join w-full">
      <input
        class="input input-sm join-item w-full"
        type={showToken ? "text" : "password"}
        placeholder={$t("settings.rows.token")}
        aria-label={$t("settings.rows.token")}
        autocomplete="off"
        spellcheck="false"
        value={device.sync.token}
        oninput={e => (device.sync.token = e.currentTarget.value)}
      />

      <button
        type="button"
        class="btn btn-sm join-item"
        aria-label={showToken ? $t("settings.sync.hideToken") : $t("settings.sync.revealToken")}
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
      {$t("settings.sync.testConnection")}
    </button>

    {#if health}
      <span class="flex items-center gap-1 text-xs text-success">
        <Icon icon="lucide:check" class="size-3.5" />
        {$t("settings.sync.connected", { values: { version: health.version, seq: health.seq } })}
      </span>
    {:else if testError}
      <span class="text-xs text-error">{testError}</span>
    {/if}
  </div>

  <Row label={$t("settings.rows.enableSync")} hint={$t("settings.hints.enableSync")}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.enableSync")}
      bind:checked={device.sync.enabled}
    />
  </Row>

  {#if !compact}
    <Row label={$t("settings.rows.interval")} hint={$t("settings.hints.interval")}>
      <select
        class="select select-sm w-32"
        aria-label={$t("settings.rows.interval")}
        bind:value={device.sync.intervalMinutes}
      >
        {#each intervals as minutes (minutes)}
          <option value={minutes}>
            {minutes === 60
              ? $t("settings.sync.everyHour")
              : $t("settings.sync.everyMinutes", { values: { minutes } })}
          </option>
        {/each}
      </select>
    </Row>

    <Row label={$t("settings.rows.collections")} hint={$t("settings.hints.collections")} stacked>
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
            {collectionLabel(name)}
          </label>
        {/each}
      </div>
    </Row>
  {/if}
</Section>

{#if !compact}
  <Section title={$t("settings.sync.status")}>
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
              ? $t("settings.sync.lastSync", { values: { when: relative(syncStatus.lastSyncAt) } })
              : $t("settings.sync.neverSynced")}
          </span>

          {#if syncStatus.pending > 0}
            <span class="text-base-content/70 tabular-nums">
              {$t("settings.sync.pending", { values: { count: syncStatus.pending } })}
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
        {$t("settings.sync.syncNow")}
      </button>
    </div>
  </Section>

  <Section
    title={$t("settings.sync.devices.title")}
    description={$t("settings.sync.devices.description")}
  >
    {#if devicesError}
      <p class="px-4 py-3 text-xs text-error">{devicesError}</p>
    {:else if devices.length === 0}
      <p class="px-4 py-3 text-sm text-base-content/60">
        {configured ? $t("settings.sync.noDevices") : $t("settings.sync.setServerFirst")}
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
                {$t("settings.sync.seen", { values: { when: relative(d.lastSeen) } })}
              </span>
            </div>

            {#if own}
              <span class="badge badge-primary badge-soft badge-xs">{$t("settings.sync.thisDevice")}</span>
            {/if}
          </div>

          {#if !own}
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onclick={() => forget(d.id)}
            >
              {$t("settings.sync.forget")}
            </button>
          {/if}
        </div>
      {/each}
    {/if}
  </Section>

  <Section title={$t("settings.sync.danger.title")} description={$t("settings.sync.danger.description")}>
    <Row
      label={$t("settings.rows.replaceLocal")}
      hint={$t("settings.hints.replaceLocal", { values: { collections: collectionList } })}
    >
      <button
        type="button"
        class="btn btn-outline btn-error btn-sm"
        disabled={!configured || busy}
        onclick={() => (confirmReplace = true)}
      >
        {$t("settings.sync.replace")}
      </button>
    </Row>

    <Row label={$t("settings.rows.resetCollection")} hint={$t("settings.hints.resetCollection")}>
      <div class="join">
        <select
          class="select select-sm join-item w-28"
          aria-label={$t("settings.sync.collection")}
          bind:value={resetCollection}
        >
          {#each syncedCollections as name (name)}
            <option value={name}>{collectionLabel(name)}</option>
          {/each}
        </select>

        <button
          type="button"
          class="btn btn-outline btn-error btn-sm join-item"
          disabled={!configured || busy}
          onclick={() => (confirmReset = true)}
        >
          {$t("common.reset")}
        </button>
      </div>
    </Row>

    <Row label={$t("settings.rows.unlinkDevice")} hint={$t("settings.hints.unlinkDevice")}>
      <button
        type="button"
        class="btn btn-outline btn-error btn-sm"
        disabled={busy}
        onclick={() => (confirmUnlink = true)}
      >
        {$t("settings.sync.unlink")}
      </button>
    </Row>
  </Section>

  <Confirm
    bind:open={confirmReplace}
    title={$t("settings.sync.confirm.replaceTitle")}
    body={$t("settings.sync.confirm.replaceBody", { values: { collections: collectionList } })}
    action={$t("settings.sync.replace")}
    onconfirm={replaceLocal}
  />

  <Confirm
    bind:open={confirmReset}
    title={$t("settings.sync.confirm.resetTitle", {
      values: { collection: collectionLabel(resetCollection) },
    })}
    body={$t("settings.sync.confirm.resetBody")}
    action={$t("common.reset")}
    onconfirm={resetRemote}
  />

  <Confirm
    bind:open={confirmUnlink}
    title={$t("settings.sync.confirm.unlinkTitle")}
    body={$t("settings.sync.confirm.unlinkBody")}
    action={$t("settings.sync.unlink")}
    onconfirm={unlink}
  />
{/if}
