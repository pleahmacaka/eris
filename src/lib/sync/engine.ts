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
import { applyVaultRemote, isEcho, vaultRecords } from "../vault/sync"
import { onVaultChange, vault } from "../vault/vault.svelte"
import { readSnapshot } from "./merge"
import {
  MAX_SNAPSHOT,
  type Snapshot,
  type StoredCollection,
  type SyncRecord,
} from "./protocol"
import {
  hydrateSyncStatus,
  refreshPairing,
  setSyncStatus,
} from "./status.svelte"

const DEBOUNCE = 1_000

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const pack = (deviceId: string, records: SyncRecord[]) =>
  JSON.stringify({ deviceId, app: "note", records } satisfies Snapshot)

const publish = async (device: DeviceSettings) => {
  const enabled = enabledCollections(device.sync)
  const stored = enabled.filter((c): c is StoredCollection => c !== "files")
  const records = await localRecords(stored)
  const loaded = vault.ready && vault.error === null && vault.root !== ""
  const files =
    enabled.includes("files") && loaded
      ? await vaultRecords(device.deviceId)
      : { records: [], oversized: [] }
  const full = pack(device.deviceId, [...records, ...files.records])

  if (full.length <= MAX_SNAPSHOT) {
    await p2pPublish(full)

    return files.oversized.length > 0
      ? `1MB를 넘는 파일 ${files.oversized.length}개는 동기화에서 제외했습니다.`
      : null
  }

  await p2pPublish(pack(device.deviceId, records))

  return "볼트가 동기화 한도(24MB)를 넘어 노트 파일을 동기화하지 않았습니다."
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
    const warning = await publish(await ensureDevice())

    const { paired, peers } = await p2pStatus()

    if (!paired) {
      setSyncStatus({ state: "unpaired", peers: 0 })

      return 0
    }

    setSyncStatus({ state: "syncing", lastError: null })

    const reached = await p2pSync()
    const meta = await updateSyncMeta(
      reached > 0
        ? { lastSyncAt: Date.now(), lastError: warning }
        : { lastError: warning },
    )

    setSyncStatus({
      state: warning ? "error" : "idle",
      lastSyncAt: meta.lastSyncAt,
      lastError: warning,
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
      const records = readSnapshot(payload).records.filter(
        r => device.sync.collections[r.collection],
      )
      const loaded = vault.ready && vault.error === null && vault.root !== ""
      const files = loaded ? records.filter(r => r.collection === "files") : []

      if (files.length > 0) {
        await vaultRecords(device.deviceId)
      }

      const touched = [
        ...(await applyRemote(records)),
        ...(await applyVaultRemote(files, device.deviceId)),
      ]

      if (touched.length > 0) {
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
    Promise.resolve(
      onVaultChange(change => {
        if (!change.external || change.paths.some(p => !isEcho(p))) {
          schedule(DEBOUNCE)
        }
      }),
    ),
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
