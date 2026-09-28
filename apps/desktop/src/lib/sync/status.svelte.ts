import { loadDevice } from "@eris/settings"
import { emit, listen } from "@tauri-apps/api/event"
import { syncMeta } from "$lib/data"
import { p2pStatus } from "$lib/native"

export type SyncState = "disabled" | "unpaired" | "syncing" | "idle" | "error"

export type SyncStatus = {
  state: SyncState
  lastSyncAt: number | null
  lastError: string | null
  peers: number
}

export const STATUS_EVENT = "sync-status"

export const syncStatus = $state<SyncStatus>({
  state: "idle",
  lastSyncAt: null,
  lastError: null,
  peers: 0,
})

export const setSyncStatus = (patch: Partial<SyncStatus>) => {
  Object.assign(syncStatus, patch)

  return emit(STATUS_EVENT, $state.snapshot(syncStatus))
}

const pairedState = (paired: boolean, state: SyncState): SyncState => {
  if (state === "disabled") {
    return state
  }

  if (!paired) {
    return "unpaired"
  }

  return state === "unpaired" ? "idle" : state
}

export const refreshPairing = async () => {
  const { paired, peers } = await p2pStatus()

  await setSyncStatus({
    state: pairedState(paired, syncStatus.state),
    peers: peers.length,
  })
}

const hydrate = async () => {
  const [device, meta, pairing] = await Promise.all([
    loadDevice(),
    syncMeta(),
    p2pStatus().catch(() => null),
  ])
  const state: SyncState = !device.sync.enabled
    ? "disabled"
    : pairing?.paired === false
      ? "unpaired"
      : meta.lastError
        ? "error"
        : "idle"

  Object.assign(syncStatus, {
    state,
    lastSyncAt: meta.lastSyncAt,
    lastError: meta.lastError,
    peers: pairing?.peers.length ?? 0,
  })
}

listen<SyncStatus>(STATUS_EVENT, e => Object.assign(syncStatus, e.payload))
hydrate().catch(() => undefined)
