import { emit, listen } from "@tauri-apps/api/event"
import { pendingOutbox, syncMeta } from "../data/store"
import { loadDevice } from "../settings"

export type SyncState = "idle" | "syncing" | "error" | "disabled"

export type SyncStatus = {
  state: SyncState
  lastSyncAt: number | null
  lastError: string | null
  pending: number
}

export const STATUS_EVENT = "sync-status"

export const syncStatus = $state<SyncStatus>({
  state: "idle",
  lastSyncAt: null,
  lastError: null,
  pending: 0,
})

export const setSyncStatus = (patch: Partial<SyncStatus>) => {
  Object.assign(syncStatus, patch)

  return emit(STATUS_EVENT, $state.snapshot(syncStatus))
}

const hydrate = async () => {
  const [device, meta, outbox] = await Promise.all([
    loadDevice(),
    syncMeta(),
    pendingOutbox(),
  ])
  const configured =
    device.sync.enabled && device.sync.url !== "" && device.sync.token !== ""

  Object.assign(syncStatus, {
    state: !configured ? "disabled" : meta.lastError ? "error" : "idle",
    lastSyncAt: meta.lastSyncAt,
    lastError: meta.lastError,
    pending: outbox.length,
  })
}

listen<SyncStatus>(STATUS_EVENT, e => Object.assign(syncStatus, e.payload))
hydrate().catch(() => undefined)
