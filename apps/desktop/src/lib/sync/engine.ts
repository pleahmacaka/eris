import {
  type DeviceSettings,
  defaultAppearance,
  defaultProfile,
  loadDevice,
  onDevice,
  type SyncSettings,
} from "@eris/settings"
import { readSnapshot } from "@eris/sync/merge"
import {
  type Snapshot,
  type SyncRecord,
  syncedCollections,
} from "@eris/sync/protocol"
import {
  applyRemote,
  conform,
  isCalendarEvent,
  isNote,
  isPreset,
  isTodo,
  localRecords,
  onDataChange,
  updateSyncMeta,
} from "$lib/data"
import {
  onP2pPeers,
  onP2pSnapshot,
  p2pPublish,
  p2pStatus,
  p2pSync,
} from "$lib/native"
import { ensureDevice } from "../device"
import { refreshPairing, setSyncStatus } from "./status.svelte"

const DEBOUNCE = 1_000

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const conformed = (record: SyncRecord): SyncRecord | null => {
  const { data } = record

  if (record.deleted) {
    return record.collection === "profile" ? null : { ...record, data: null }
  }

  switch (record.collection) {
    case "profile":
      return record.id === "profile"
        ? { ...record, data: conform(defaultProfile, data) }
        : null
    case "presets":
      return isPreset(data)
        ? {
            ...record,
            data: {
              ...data,
              appearance: conform(defaultAppearance, data.appearance),
            },
          }
        : null
    case "todos":
      return isTodo(data) ? record : null
    case "events":
      return isCalendarEvent(data) ? record : null
    case "notes":
      return isNote(data) ? record : null
  }
}

const received = (payload: string, sync: SyncSettings) =>
  readSnapshot(payload)
    .filter(r => sync.collections[r.collection])
    .map(conformed)
    .filter(r => r !== null)

const snapshot = (deviceId: string, records: SyncRecord[]) =>
  JSON.stringify({ deviceId, records } satisfies Snapshot)

const publish = async (device: DeviceSettings) => {
  const enabled = syncedCollections.filter(
    name => device.sync.collections[name],
  )

  await p2pPublish(snapshot(device.deviceId, await localRecords(enabled)))
}

const exclusive = <T>(task: () => Promise<T>) =>
  "locks" in navigator ? navigator.locks.request("eris-sync", task) : task()

const fail = async (error: unknown) => {
  const lastError = message(error)

  await updateSyncMeta({ lastError })
  await setSyncStatus({ state: "error", lastError })
}

const run = async () => {
  const device = await ensureDevice()

  if (!device.sync.enabled) {
    await setSyncStatus({ state: "disabled" })

    return 0
  }

  try {
    await publish(device)

    const { paired, peers } = await p2pStatus()

    if (!paired) {
      await setSyncStatus({ state: "unpaired", peers: 0 })

      return 0
    }

    await setSyncStatus({ state: "syncing", lastError: null })

    const reached = await p2pSync()
    const meta = await updateSyncMeta(
      reached > 0
        ? { lastSyncAt: Date.now(), lastError: null }
        : { lastError: null },
    )

    await setSyncStatus({
      state: "idle",
      lastSyncAt: meta.lastSyncAt,
      lastError: null,
      peers: peers.length,
    })

    return reached
  } catch (error) {
    await fail(error)

    return 0
  }
}

let running: Promise<number> | null = null

export const syncNow = () => {
  running ??= exclusive(run).finally(() => {
    running = null
  })

  return running
}

const applySnapshot = (payload: string) =>
  exclusive(async () => {
    try {
      const device = await ensureDevice()

      if (!device.sync.enabled) {
        return
      }

      const changed = await applyRemote(received(payload, device.sync))

      if (changed.length > 0) {
        await publish(device)
      }

      const meta = await updateSyncMeta({ lastSyncAt: Date.now() })

      await setSyncStatus({ lastSyncAt: meta.lastSyncAt })
    } catch (error) {
      await fail(error)
    }
  })

const fingerprint = (sync: SyncSettings) =>
  JSON.stringify([
    sync.enabled,
    sync.intervalMinutes,
    syncedCollections.map(name => sync.collections[name]),
  ])

export const startAutoSync = () => {
  let timer: ReturnType<typeof setInterval> | undefined
  let debounce: ReturnType<typeof setTimeout> | undefined
  let current: DeviceSettings | null = null

  const schedule = (delay: number) => {
    clearTimeout(debounce)
    debounce = setTimeout(syncNow, delay)
  }

  const arm = (device: DeviceSettings) => {
    const previous = current
    current = device

    if (previous && fingerprint(previous.sync) === fingerprint(device.sync)) {
      return
    }

    clearInterval(timer)
    clearTimeout(debounce)

    if (!device.sync.enabled) {
      setSyncStatus({ state: "disabled" })

      if (previous?.sync.enabled) {
        p2pPublish(snapshot(device.deviceId, [])).catch(() => undefined)
      }

      return
    }

    timer = setInterval(
      syncNow,
      Math.max(1, device.sync.intervalMinutes) * 60_000,
    )
    schedule(previous ? DEBOUNCE : 0)
  }

  loadDevice().then(arm)

  const unlisteners = [
    onDevice(arm),
    onDataChange(change => {
      if (!change.remote && current?.sync.enabled) {
        schedule(DEBOUNCE)
      }
    }),
    onP2pSnapshot(applySnapshot),
    onP2pPeers(() => {
      refreshPairing().catch(() => undefined)
    }),
  ]

  return () => {
    clearInterval(timer)
    clearTimeout(debounce)

    for (const pending of unlisteners) {
      pending.then(fn => fn())
    }
  }
}
