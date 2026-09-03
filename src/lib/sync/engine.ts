import {
  advanceCursors,
  applyRemote,
  clearAllOutbox,
  clearLocal,
  clearOutbox,
  cursorGroups,
  onDataChange,
  pendingOutbox,
  resetCursors,
  takeOutbox,
  updateSyncMeta,
} from "../data/store"
import { ensureDevice } from "../device"
import { httpFetch } from "../platform/http"
import {
  type DeviceSettings,
  enabledCollections,
  loadDevice,
  onDevice,
} from "../settings"
import { outboxKey } from "./merge"
import {
  type DeviceInfo,
  type HealthResponse,
  normalizeUrl,
  type Peer,
  type PullResponse,
  type PushRequest,
  type PushResponse,
  type RegisterRequest,
  type ResetResponse,
  type StoredRecord,
  type SyncedCollection,
} from "./protocol"
import { dropPeerStatus, setPeerStatus, setSyncStatus } from "./status.svelte"

const PAGE = 500
const DEBOUNCE = 2_000
const PROBE_TIMEOUT = 4_000

const request = async <T>(
  peer: Pick<Peer, "url" | "token">,
  method: string,
  path: string,
  body?: unknown,
  timeout?: number,
): Promise<T> => {
  const response = await httpFetch(`${normalizeUrl(peer.url)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${peer.token.trim()}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
  })

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200)

    throw new Error(`${response.status} ${detail || response.statusText}`)
  }

  return response.status === 204 ? (undefined as T) : response.json()
}

const usablePeers = (device: DeviceSettings) =>
  device.sync.peers.filter(p => p.enabled && p.url.trim() !== "")

const configured = (device: DeviceSettings) =>
  device.sync.enabled && usablePeers(device).length > 0

const fingerprint = (device: DeviceSettings) =>
  JSON.stringify([
    device.sync.enabled,
    device.sync.intervalMinutes,
    device.sync.collections,
    device.sync.peers,
  ])

export const probe = async (peer: Pick<Peer, "url" | "token">) => {
  const started = Date.now()
  const health = await request<HealthResponse>(
    peer,
    "GET",
    "/health",
    undefined,
    PROBE_TIMEOUT,
  )

  await request<DeviceInfo[]>(peer, "GET", "/devices", undefined, PROBE_TIMEOUT)

  return { ...health, latencyMs: Date.now() - started }
}

const reachable = async (peer: Peer) => {
  try {
    const health = await probe(peer)

    setPeerStatus({
      id: peer.id,
      label: peer.label,
      url: peer.url,
      role: peer.role,
      state: "online",
      seq: health.seq,
      latencyMs: health.latencyMs,
      lastError: null,
    })

    return true
  } catch (error) {
    setPeerStatus({
      id: peer.id,
      label: peer.label,
      url: peer.url,
      role: peer.role,
      state: "offline",
      seq: null,
      latencyMs: null,
      lastError: message(error),
    })

    return false
  }
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const register = (device: DeviceSettings, peer: Peer) =>
  request<DeviceInfo>(peer, "POST", "/sync/register", {
    deviceId: device.deviceId,
    deviceName: device.deviceName,
  } satisfies RegisterRequest)

const pushTo = async (
  device: DeviceSettings,
  peer: Peer,
  outbox: Awaited<ReturnType<typeof takeOutbox>>,
) => {
  let applied = 0

  for (let at = 0; at < outbox.length; at += PAGE) {
    const result = await request<PushResponse>(peer, "POST", "/sync/push", {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      records: outbox.slice(at, at + PAGE),
    } satisfies PushRequest)

    applied += result.applied
  }

  return applied
}

const pullPage = (
  device: DeviceSettings,
  peer: Peer,
  since: number,
  collections: SyncedCollection[],
) =>
  request<PullResponse>(
    peer,
    "GET",
    `/sync/pull?since=${since}&limit=${PAGE}&collections=${collections.join(
      ",",
    )}&device=${encodeURIComponent(device.deviceId)}`,
  )

const pullFrom = async (
  device: DeviceSettings,
  peer: Peer,
  collections: SyncedCollection[],
  from?: number,
) => {
  const groups =
    from === undefined
      ? await cursorGroups(peer.id, collections)
      : [{ since: from, names: collections }]
  const records: StoredRecord[] = []
  const heads: number[] = []

  for (const group of groups) {
    let cursor = group.since

    while (true) {
      const page = await pullPage(device, peer, cursor, group.names)

      records.push(...page.records)

      if (!page.hasMore) {
        heads.push(page.seq)
        break
      }

      cursor = page.records.at(-1)?.seq ?? page.seq
    }
  }

  return { records, cursor: heads.length > 0 ? Math.min(...heads) : 0 }
}

const pendingCount = async () => (await pendingOutbox()).length

let running: Promise<void> | null = null

const run = async () => {
  const device = await ensureDevice()
  const peers = usablePeers(device)
  const collections = enabledCollections(device.sync)

  if (!configured(device) || collections.length === 0) {
    setSyncStatus({ state: "disabled", pending: await pendingCount() })

    return
  }

  setSyncStatus({ state: "syncing", lastError: null })

  const alive: Peer[] = []

  for (const peer of await Promise.all(
    peers.map(async peer => ({ peer, ok: await reachable(peer) })),
  )) {
    if (peer.ok) {
      alive.push(peer.peer)
    }
  }

  if (alive.length === 0) {
    const lastError = "연결 가능한 노드 없음"

    await updateSyncMeta({ lastError })
    setSyncStatus({
      state: "error",
      lastError,
      pending: await pendingCount(),
    })

    return
  }

  const outbox = await takeOutbox()
  const errors: string[] = []
  let accepted = false

  for (const peer of alive) {
    try {
      await register(device, peer)

      if (outbox.length > 0) {
        await pushTo(device, peer, outbox)
      }

      accepted = true
    } catch (error) {
      errors.push(`${peer.label || peer.url}: ${message(error)}`)
    }
  }

  if (accepted) {
    await clearOutbox(outbox.map(outboxKey))
  }

  for (const peer of alive) {
    try {
      const pulled = await pullFrom(device, peer, collections)

      await applyRemote(pulled.records)
      await advanceCursors(peer.id, collections, pulled.cursor)
    } catch (error) {
      errors.push(`${peer.label || peer.url}: ${message(error)}`)
    }
  }

  const lastError = errors.length > 0 ? errors.join("\n") : null
  const meta = await updateSyncMeta({ lastSyncAt: Date.now(), lastError })

  setSyncStatus({
    state: lastError ? "error" : "idle",
    lastSyncAt: meta.lastSyncAt,
    lastError,
    pending: await pendingCount(),
  })
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

    if (previous && fingerprint(previous) === fingerprint(device)) {
      return
    }

    for (const id of previousPeerIds(previous, device)) {
      dropPeerStatus(id)
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

const previousPeerIds = (
  previous: DeviceSettings | null,
  next: DeviceSettings,
) => {
  const kept = new Set(next.sync.peers.map(p => p.id))

  return (previous?.sync.peers ?? []).map(p => p.id).filter(id => !kept.has(id))
}

export const pullEverything = async (peer: Peer) => {
  const device = await ensureDevice()
  const collections = enabledCollections(device.sync)
  const pulled = await pullFrom(device, peer, collections, 0)

  await applyRemote(pulled.records)
  await advanceCursors(peer.id, collections, pulled.cursor)
  await updateSyncMeta({ lastSyncAt: Date.now(), lastError: null })
  setSyncStatus({ state: "idle", lastSyncAt: Date.now(), lastError: null })

  return pulled.records.length
}

export const resetFromPeers = async () => {
  const device = await ensureDevice()
  const collections = enabledCollections(device.sync)

  await clearAllOutbox()
  await clearLocal(collections)
  await resetCursors()

  for (const peer of usablePeers(device)) {
    if (await reachable(peer)) {
      const pulled = await pullFrom(device, peer, collections, 0)

      await applyRemote(pulled.records, false)
      await advanceCursors(peer.id, collections, pulled.cursor)
    }
  }

  await updateSyncMeta({ lastSyncAt: Date.now(), lastError: null })
  setSyncStatus({
    state: "idle",
    lastSyncAt: Date.now(),
    lastError: null,
    pending: 0,
  })
}

export const listDevices = (peer: Peer) =>
  request<DeviceInfo[]>(peer, "GET", "/devices")

export const forgetDevice = (peer: Peer, id: string) =>
  request<void>(peer, "DELETE", `/devices/${encodeURIComponent(id)}`)

export const resetCollection = async (
  peer: Peer,
  collection: SyncedCollection,
) => {
  const result = await request<ResetResponse>(
    peer,
    "DELETE",
    `/collections/${collection}`,
  )

  await syncNow()

  return result
}
