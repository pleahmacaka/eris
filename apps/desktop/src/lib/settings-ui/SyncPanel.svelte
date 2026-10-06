<script lang="ts">
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import {
    type DeviceSettings,
    defaultSync,
    saveDevice,
  } from "@eris/settings"
  import { reset } from "./reset"
  import {
    onP2pPeers,
    type P2pStatus,
    p2pInvite,
    p2pJoin,
    p2pLeave,
    p2pStatus,
  } from "$lib/native"
  import { refreshPairing, syncNow, syncStatus } from "$lib/sync"
  import {
    type SyncedCollection,
    syncedCollections,
  } from "@eris/sync/protocol"
  import { Confirm, Row, Section } from "@eris/ui"
  import { toast } from "@eris/ui"
  import { locale, t } from "svelte-i18n"

  let {
    device = $bindable(),
    compact = false,
  }: { device: DeviceSettings; compact?: boolean } = $props()

  type PanelState = "disabled" | "unpaired" | "waiting" | "idle" | "syncing" | "error"

  const tones: Record<PanelState, string> = {
    disabled: "badge-ghost",
    unpaired: "badge-ghost",
    waiting: "badge-warning",
    idle: "badge-success",
    syncing: "badge-info",
    error: "badge-error",
  }

  const resetSync = reset(() => device.sync, defaultSync)

  const locked = $derived([
    "flex flex-col gap-4 transition-opacity duration-100",
    !device.sync.enabled && "opacity-40",
  ])

  const collectionLabel = (name: SyncedCollection) => $t(`settings.sync.collections.${name}`)

  // todos still sync for older paired devices, but nothing here shows them anymore
  const shownCollections = syncedCollections.filter(name => name !== "todos")

  const collectionList = $derived(
    new Intl.ListFormat($locale ?? "en").format(
      shownCollections.map(name => collectionLabel(name).toLowerCase()),
    ),
  )

  const intervals = [1, 5, 15, 60]

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  let pairing = $state<P2pStatus | null>(null)
  let code = $state("")
  let joinCode = $state("")
  let busy = $state(false)
  let syncing = $state(false)
  let confirmLeave = $state(false)
  let now = $state(Date.now())

  const paired = $derived(pairing?.paired ?? false)
  const peers = $derived(pairing?.peers ?? [])

  const panelState = $derived.by((): PanelState => {
    if (!device.sync.enabled) {
      return "disabled"
    }

    if (syncing || syncStatus.state === "syncing") {
      return "syncing"
    }

    if (syncStatus.state === "error") {
      return "error"
    }

    if (!paired && !code) {
      return "unpaired"
    }

    return peers.length === 0 ? "waiting" : "idle"
  })

  const refresh = async () => {
    const before = peers.length

    pairing = await p2pStatus().catch(() => null)

    if (peers.length > before) {
      code = ""
    }
  }

  $effect(() => {
    untrack(refresh)

    const stop = onP2pPeers(refresh)
    const timer = setInterval(() => (now = Date.now()), 30_000)

    return () => {
      clearInterval(timer)
      stop.then(fn => fn())
    }
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

  const settle = async () => {
    await refresh()
    await refreshPairing().catch(() => undefined)
  }

  const act = async (task: () => Promise<void>) => {
    busy = true

    try {
      await task()
    } catch (error) {
      toast(message(error), "error")
    } finally {
      busy = false
    }
  }

  const invite = () =>
    act(async () => {
      await flush()
      code = await p2pInvite(device.deviceName)
      await settle()
      await syncNow()
    })

  const join = () =>
    act(async () => {
      await flush()
      await p2pJoin(joinCode.trim(), device.deviceName)
      joinCode = ""
      code = ""
      await settle()
      toast($t("settings.sync.toasts.joined"), "success")
      await syncNow()
    })

  const leave = () =>
    act(async () => {
      await p2pLeave()
      code = ""
      await settle()
      toast($t("settings.sync.toasts.unlinked"), "success")
    })

  const copy = () =>
    act(async () => {
      await navigator.clipboard.writeText(code)
      toast($t("settings.sync.toasts.copied"), "success")
    })

  const sync = async () => {
    syncing = true

    try {
      await flush()

      const reached = await syncNow()

      if (syncStatus.state === "error") {
        toast(syncStatus.lastError ?? $t("settings.sync.toasts.failed"), "error")
      } else if (reached === 0) {
        toast($t("settings.sync.toasts.noPeers"), "info")
      } else {
        toast($t("settings.sync.toasts.synced", { values: { count: reached } }), "success")
      }

      await refresh()
    } finally {
      syncing = false
    }
  }
</script>

<div class={compact ? "grid grid-cols-2 items-start gap-4" : "flex flex-col gap-4"}>
<div class="flex flex-col gap-4">
<Section title={$t("settings.groups.syncGeneral")}>
  <Row label={$t("settings.rows.enableSync")} hint={$t("settings.hints.enableSync")}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.enableSync")}
      bind:checked={device.sync.enabled}
    />
  </Row>

  <Row
    label={$t("settings.rows.showSyncStatus")}
    hint={$t("settings.hints.showSyncStatus")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.showSyncStatus")}
      disabled={!device.sync.enabled}
      bind:checked={device.showSyncStatus}
    />
  </Row>
</Section>

<fieldset class={locked} disabled={!device.sync.enabled}>
<Section
  title={$t("settings.sync.thisDevice")}
  description={$t("settings.sync.description", { values: { collections: collectionList } })}
>
  <div class="flex items-center justify-between gap-4 px-4 py-3">
    <div class="flex min-w-0 items-center gap-3">
      <Icon icon="lucide:laptop" class="size-4 shrink-0 text-base-content/60" />

      <div class="flex min-w-0 flex-col gap-1">
        <div class="flex items-center gap-2 text-sm">
          <span class="truncate font-medium">{device.deviceName}</span>

          <span class={["badge badge-sm", tones[panelState]]}>
            {$t(`settings.sync.states.${panelState}`)}
          </span>
        </div>

        <span class="text-xs text-base-content/60">
          {syncStatus.lastSyncAt
            ? $t("settings.sync.lastSync", { values: { when: relative(syncStatus.lastSyncAt) } })
            : $t("settings.sync.neverSynced")}
        </span>

        {#if panelState === "error" && syncStatus.lastError}
          <span class="truncate text-xs text-error">{syncStatus.lastError}</span>
        {/if}
      </div>
    </div>

    <button
      type="button"
      class="btn btn-primary btn-sm"
      disabled={!paired || panelState === "syncing"}
      onclick={sync}
    >
      {#if panelState === "syncing"}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <Icon icon="lucide:refresh-cw" class="size-4" />
      {/if}
      {$t("settings.sync.syncNow")}
    </button>
  </div>

  {#if !compact}
    <Row
      label={$t("settings.rows.interval")}
      hint={$t("settings.hints.interval")}
      onreset={resetSync("intervalMinutes")}
    >
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

    <Row
      label={$t("settings.rows.collections")}
      hint={$t("settings.hints.collections")}
      stacked
      onreset={resetSync("collections")}
    >
      <div class="flex flex-wrap gap-2">
        {#each shownCollections as name (name)}
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
</fieldset>
</div>

<fieldset class={locked} disabled={!device.sync.enabled}>
<Section
  title={$t("settings.sync.devices.title")}
  description={$t("settings.sync.devices.description")}
>
  {#if peers.length === 0}
    <p class="px-4 py-3 text-sm text-base-content/60">{$t("settings.sync.noDevices")}</p>
  {:else}
    {#each peers as peer (peer.nodeId)}
      <div class="flex min-w-0 items-center gap-3 px-4 py-2.5">
        <Icon icon="lucide:monitor" class="size-4 shrink-0 text-base-content/60" />

        <div class="flex min-w-0 flex-col">
          <span class="truncate text-sm">{peer.name || peer.nodeId.slice(0, 8)}</span>

          <span class="text-xs text-base-content/60">
            {peer.lastSeen === null
              ? $t("settings.sync.neverSeen")
              : $t("settings.sync.seen", { values: { when: relative(peer.lastSeen) } })}
          </span>
        </div>
      </div>
    {/each}
  {/if}

  <Row label={$t("settings.rows.pairDevice")} hint={$t("settings.hints.pairDevice")}>
    <button type="button" class="btn btn-soft btn-sm" disabled={busy} onclick={invite}>
      <Icon icon="lucide:link" class="size-4" />
      {$t("settings.sync.createCode")}
    </button>
  </Row>

  {#if code}
    <div class="px-4 py-3">
      <div class="join w-full">
        <input
          class="input input-sm join-item w-full"
          readonly
          aria-label={$t("settings.sync.codePlaceholder")}
          value={code}
        />

        <button type="button" class="btn btn-sm join-item" disabled={busy} onclick={copy}>
          <Icon icon="lucide:copy" class="size-4" />
          {$t("settings.sync.copyCode")}
        </button>
      </div>
    </div>
  {/if}

  {#if paired}
    <Row label={$t("settings.rows.unlinkDevice")} hint={$t("settings.hints.unlinkDevice")}>
      <button
        type="button"
        class="btn btn-outline btn-error btn-sm"
        disabled={busy}
        onclick={() => (confirmLeave = true)}
      >
        {$t("settings.sync.unlink")}
      </button>
    </Row>
  {:else}
    <Row label={$t("settings.rows.joinDevice")} hint={$t("settings.hints.joinDevice")} stacked>
      <div class="join w-full">
        <input
          class="input input-sm join-item w-full"
          placeholder={$t("settings.sync.codePlaceholder")}
          aria-label={$t("settings.sync.codePlaceholder")}
          autocomplete="off"
          spellcheck="false"
          bind:value={joinCode}
        />

        <button
          type="button"
          class="btn btn-primary btn-sm join-item"
          disabled={busy || joinCode.trim() === ""}
          onclick={join}
        >
          {$t("settings.sync.joinWithCode")}
        </button>
      </div>
    </Row>
  {/if}
</Section>

<Confirm
  bind:open={confirmLeave}
  title={$t("settings.sync.confirm.unlinkTitle")}
  body={$t("settings.sync.confirm.unlinkBody")}
  action={$t("settings.sync.unlink")}
  onconfirm={leave}
/>
</fieldset>
</div>
