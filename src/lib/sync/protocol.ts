export const syncedCollections = ["notes", "todos", "events"] as const

export type SyncedCollection = (typeof syncedCollections)[number]

export type SyncRecord = {
  collection: SyncedCollection
  id: string
  updatedAt: number
  deleted: boolean
  deviceId: string
  data: unknown
}

export type Snapshot = {
  deviceId: string
  records: SyncRecord[]
}

export const MAX_CLOCK_SKEW = 24 * 60 * 60 * 1000

export const TOMBSTONE_TTL = 30 * 24 * 60 * 60 * 1000

export const isSyncedCollection = (value: string): value is SyncedCollection =>
  (syncedCollections as readonly string[]).includes(value)
