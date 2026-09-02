import { fetch } from "@tauri-apps/plugin-http"
import {
  advanceCursors,
  applyRemote,
  clearAllOutbox,
  clearLocal,
  clearOutbox,
  cursorGroups,
  onDataChange,
  pendingOutbox,
  takeOutbox,
  updateSyncMeta,
} from "../data/store"
import { ensureDevice } from "../device"
import {
  type DeviceSettings,
  defaultSync,
  loadDevice,
  onDevice,
  type SyncSettings,
  saveDevice,
} from "../settings"
import { outboxKey } from "./merge"
import {
  type DeviceInfo,
  type HealthResponse,
  type PullResponse,
  type PushRequest,
  type PushResponse,
  type RegisterRequest,
  type ResetResponse,
  type StoredRecord,
  type SyncedCollection,
  type SyncRecord,
  syncedCollections,
} from "./protocol"
import { setSyncStatus } from "./status.svelte"

type Connection = { url: string; token: string }

const PAGE = 500
const DEBOUNCE = 3_000

const request = async <T>(
  { url, token }: Connection,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> => {
  const response = await fetch(`${url.trim().replace(/\/+$/, "")}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200)

    throw new Error(`${response.status} ${detail || response.statusText}`)
  }

  return response.status === 204 ? (undefined as T) : response.json()
}

const configured = (device: DeviceSettings) =>
  device.sync.enabled &&
  device.sync.url.trim() !== "" &&
  device.sync.token.trim() !== ""

const enabledCollections = (device: DeviceSettings) =>
  syncedCollections.filter(name => device.sync.collections[name])

const enabledIn =
  (device: DeviceSettings) =>
  (record: Pick<SyncRecord, "collection">): boolean =>
    device.sync.collections[record.collection]

const fingerprint = (sync: SyncSettings) =>
  JSON.stringify([
    sync.enabled,
    sync.url,
    sync.token,
    sync.intervalMinutes,
    syncedCollections.map(name => sync.collections[name]),
  ])

const register = (device: DeviceSettings) =>
  request<DeviceInfo>(device.sync, "POST", "/sync/register", {
    deviceId: device.deviceId,
    deviceName: device.deviceName,
  } satisfies RegisterRequest)

const pullAll = async (
  device: DeviceSettings,
  since: number,
  collections: SyncedCollection[],
) => {
  const records: StoredRecord[] = []
  let cursor = since

  while (true) {
    const page = await request<PullResponse>(
      device.sync,
      "GET",
      `/sync/pull?since=${cursor}&limit=${PAGE}&collections=${collections.join(",")}&device=${encodeURIComponent(device.deviceId)}`,
    )

    records.push(...page.records)

    if (!page.hasMore) {
      return { records, cursor: page.seq }
    }

    cursor = page.records.at(-1)?.seq ?? page.seq
  }
}

const pullEnabled = async (device: DeviceSettings, since?: number) => {
  const enabled = enabledCollections(device)

  if (enabled.length === 0) {
    return { enabled, records: [], cursor: 0 }
  }

  const groups =
    since === undefined
      ? await cursorGroups(enabled)
      : [{ since, names: enabled }]
  const records: StoredRecord[] = []
  const heads: number[] = []

  for (const group of groups) {
    const pulled = await pullAll(device, group.since, group.names)

    records.push(...pulled.records.filter(enabledIn(device)))
    heads.push(pulled.cursor)
  }

  return { enabled, cursor: Math.min(...heads), records }
}

const push = async (device: DeviceSettings) => {
  const outbox = await takeOutbox()
  let applied = 0

  for (let at = 0; at < outbox.length; at += PAGE) {
    const chunk = outbox.slice(at, at + PAGE)
    const result = await request<PushResponse>(
      device.sync,
      "POST",
      "/sync/push",
      {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        records: chunk,
      } satisfies PushRequest,
    )

    applied += result.applied
    await clearOutbox(chunk.map(outboxKey))
  }

  return applied
}

const pendingCount = async () => (await pendingOutbox()).length

let running: Promise<{ pushed: number; pulled: number }> | null = null

export const testConnection = async (url: string, token: string) => {
  const connection = { url, token }
  const health = await request<HealthResponse>(connection, "GET", "/health")

  await request<DeviceInfo[]>(connection, "GET", "/devices")

  return health
}

const run = async () => {
  const device = await ensureDevice()

  if (!configured(device)) {
    await setSyncStatus({ state: "disabled", pending: await pendingCount() })

    return { pushed: 0, pulled: 0 }
  }

  await setSyncStatus({ state: "syncing", lastError: null })

  try {
    await register(device)

    const pushed = await push(device)
    const pulled = await pullEnabled(device)

    await applyRemote(pulled.records)
    await advanceCursors(pulled.enabled, pulled.cursor)

    const meta = await updateSyncMeta({
      lastSyncAt: Date.now(),
      lastError: null,
    })

    await setSyncStatus({
      state: "idle",
      lastSyncAt: meta.lastSyncAt,
      lastError: null,
      pending: await pendingCount(),
    })

    return { pushed, pulled: pulled.records.length }
  } catch (error) {
    const lastError = error instanceof Error ? error.message : String(error)

    await updateSyncMeta({ lastError })
    await setSyncStatus({
      state: "error",
      lastError,
      pending: await pendingCount(),
    })

    return { pushed: 0, pulled: 0 }
  }
}

export const syncNow = () => {
  running ??= run().finally(() => {
    running = null
  })

  return running
}

export const startAutoSync = () => {
  let timer: ReturnType<typeof setInterval> | undefined
  let debounce: ReturnType<typeof setTimeout> | undefined
  let current: DeviceSettings | null = null

  const arm = (device: DeviceSettings) => {
    const previous = current
    current = device

    if (previous && fingerprint(previous.sync) === fingerprint(device.sync)) {
      return
    }

    clearInterval(timer)
    clearTimeout(debounce)

    if (!configured(device)) {
      setSyncStatus({ state: "disabled" })

      return
    }

    timer = setInterval(
      syncNow,
      Math.max(1, device.sync.intervalMinutes) * 60_000,
    )
    debounce = setTimeout(syncNow, previous ? DEBOUNCE : 0)
  }

  loadDevice().then(arm)

  const unlisteners = [
    onDevice(arm),
    onDataChange(() => {
      if (!current || !configured(current) || running) {
        return
      }

      clearTimeout(debounce)
      debounce = setTimeout(syncNow, DEBOUNCE)
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

export const resetFromServer = async () => {
  const device = await ensureDevice()
  const pulled = await pullEnabled(device, 0)

  await clearAllOutbox()
  await clearLocal(pulled.enabled)
  await applyRemote(pulled.records)
  await advanceCursors(pulled.enabled, pulled.cursor)
  await updateSyncMeta({ lastSyncAt: Date.now(), lastError: null })
  await setSyncStatus({
    state: "idle",
    lastSyncAt: Date.now(),
    lastError: null,
    pending: 0,
  })
}

export const resetServer = async (collection: SyncedCollection) => {
  const device = await ensureDevice()
  const result = await request<ResetResponse>(
    device.sync,
    "DELETE",
    `/collections/${collection}`,
  )

  await syncNow()

  return result
}

export const listDevices = async () => {
  const device = await ensureDevice()

  return request<DeviceInfo[]>(device.sync, "GET", "/devices")
}

export const forgetDevice = async (id: string) => {
  const device = await ensureDevice()

  await request<void>(
    device.sync,
    "DELETE",
    `/devices/${encodeURIComponent(id)}`,
  )
}

export const unlinkDevice = async () => {
  const device = await loadDevice()

  await saveDevice({ ...device, sync: defaultSync })
  await clearAllOutbox()
  await updateSyncMeta({ cursors: {}, lastSyncAt: null, lastError: null })
  await setSyncStatus({
    state: "disabled",
    lastSyncAt: null,
    lastError: null,
    pending: 0,
  })
}
