export const syncedCollections = [
  "todos",
  "events",
  "profile",
  "presets",
  "notes",
] as const

export type SyncedCollection = (typeof syncedCollections)[number]

export type SyncRecord = {
  collection: SyncedCollection
  id: string
  updatedAt: number
  deleted: boolean
  deviceId: string
  data: unknown
}

export type StoredRecord = SyncRecord & { seq: number }

export type PushRequest = {
  deviceId: string
  deviceName: string
  records: SyncRecord[]
}

export type PushResponse = {
  seq: number
  applied: number
  stale: string[]
}

export type PullResponse = {
  seq: number
  records: StoredRecord[]
  hasMore: boolean
}

export type DeviceInfo = {
  id: string
  name: string
  createdAt: number
  lastSeen: number
}

export type RegisterRequest = {
  deviceId: string
  deviceName: string
}

export type ResetResponse = {
  seq: number
  tombstoned: number
}

export type HealthResponse = {
  ok: true
  version: string
  seq: number
}

export const isSyncedCollection = (value: string): value is SyncedCollection =>
  (syncedCollections as readonly string[]).includes(value)
