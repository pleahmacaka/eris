import type { AppTag } from "@eris/bridge"

export {
  type AppTag,
  MAX_CLOCK_SKEW,
  TOMBSTONE_TTL,
} from "@eris/bridge"

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

export type Snapshot = {
  deviceId: string
  app?: AppTag
  records: SyncRecord[]
}

export const isSyncedCollection = (value: string): value is SyncedCollection =>
  (syncedCollections as readonly string[]).includes(value)
