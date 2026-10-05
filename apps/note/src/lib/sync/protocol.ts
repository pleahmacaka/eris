import type { AppTag } from "@eris/bridge"

export {
  type AppTag,
  MAX_CLOCK_SKEW,
  TOMBSTONE_TTL,
} from "@eris/bridge"

export const syncedCollections = ["files", "todos", "events"] as const

export type SyncedCollection = (typeof syncedCollections)[number]

export type StoredCollection = Exclude<SyncedCollection, "files">

export type SyncRecord = {
  collection: SyncedCollection
  id: string
  updatedAt: number
  deleted: boolean
  deviceId: string
  data: unknown
}

export type FileData = { content: string; base: string | null }

export type Snapshot = {
  deviceId: string
  app: AppTag
  records: SyncRecord[]
}

export const MAX_FILE = 1024 * 1024

export const MAX_SNAPSHOT = 24 * 1024 * 1024

export const isSyncedCollection = (value: string): value is SyncedCollection =>
  (syncedCollections as readonly string[]).includes(value)
