import {
  applyRemote,
  localRecords,
  onDataChange,
  updateSyncMeta,
} from "../data/store"
import { ensureDevice } from "../device"
import {
  onP2pPeers,
  onP2pSnapshot,
  p2pPublish,
  p2pStatus,
  p2pSupported,
  p2pSync,
} from "../platform/p2p"
import {
  type DeviceSettings,
  enabledCollections,
  loadDevice,
  onDevice,
  type SyncSettings,
} from "../settings"
import { readSnapshot } from "./merge"
import type { Snapshot } from "./protocol"
import {
  hydrateSyncStatus,
  refreshPairing,
  setSyncStatus,
} from "./status.svelte"

const DEBOUNCE = 1_000

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const publish = async (device: DeviceSettings) => {
  const records = await localRecords(enabledCollections(device.sync))

  await p2pPublish(
    JSON.stringify({ deviceId: device.deviceId, records } satisfies Snapshot),
  )
}

const exclusive = <T>(task: () => Promise<T>) =>
  globalThis.navigator?.locks
    ? navigator.locks.request("arixlab-note-sync", task)
    : task()

const fail = async (error: unknown) => {
  const lastError = message(error)

  await updateSyncMeta({ lastError })
  setSyncStatus({ state: "error", lastError })
}

const run = async () => {
  if (!p2pSupported()) {
    return 0
  }

  try {
    await publish(await ensureDevice())

    const { paired, peers } = await p2pStatus()

    if (!paired) {
      setSyncStatus({ state: "unpaired", peers: 0 })

      return 0
    }

    setSyncStatus({ state: "syncing", lastError: null })

    const reached = await p2pSync()
    const meta = await updateSyncMeta(
      reached > 0
        ? { lastSyncAt: Date.now(), lastError: null }
        : { lastError: null },
    )

    setSyncStatus({
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
      const records = readSnapshot(payload).filter(
        r => device.sync.collections[r.collection],
      )

      if ((await applyRemote(records)).length > 0) {
        await publish(device)
      }

      const meta = await updateSyncMeta({ lastSyncAt: Date.now() })

      setSyncStatus({ lastSyncAt: meta.lastSyncAt })
    } catch (error) {
      await fail(error)
    }
  })

const fingerprint = (sync: SyncSettings) =>
  JSON.stringify([sync.intervalMinutes, sync.collections])

export const startAutoSync = () => {
  if (!p2pSupported()) {
    setSyncStatus({ state: "unsupported" })

    return () => {}
  }

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
    timer = setInterval(
      syncNow,
      Math.max(1, device.sync.intervalMinutes) * 60_000,
    )
    schedule(previous ? DEBOUNCE : 0)
  }

  hydrateSyncStatus().catch(() => undefined)
  loadDevice().then(arm)

  const unlisteners = [
    onDevice(arm),
    onDataChange(change => {
      if (!change.remote) {
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
