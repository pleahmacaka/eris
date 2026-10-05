import { isCalendarEvent, isRecord, isTodo } from "../data/guards"
import { filePath } from "../vault/paths"
import {
  type AppTag,
  isSyncedCollection,
  MAX_CLOCK_SKEW,
  MAX_FILE,
  type SyncRecord,
} from "./protocol"

export type Versioned = { updatedAt: number; deviceId?: string }

export type LocalItem = Versioned & { id: string }

export const isPoisoned = (updatedAt: number, now = Date.now()) =>
  !Number.isSafeInteger(updatedAt) || updatedAt > now + MAX_CLOCK_SKEW

export const remoteWins = (
  remote: Pick<SyncRecord, "updatedAt" | "deviceId">,
  local: Versioned | undefined,
  ownDeviceId: string,
) =>
  !local ||
  isPoisoned(local.updatedAt) ||
  remote.updatedAt > local.updatedAt ||
  (remote.updatedAt === local.updatedAt &&
    remote.deviceId < (local.deviceId ?? ownDeviceId))

export const toLocal = (
  record: SyncRecord,
): LocalItem & Record<string, unknown> => ({
  ...((record.data as object) ?? {}),
  id: record.id,
  updatedAt: record.updatedAt,
  deviceId: record.deviceId,
})

const isText = (value: unknown): value is string =>
  typeof value === "string" && value !== ""

const isFileData = (value: unknown) =>
  isRecord(value) &&
  typeof value.content === "string" &&
  value.content.length <= MAX_FILE &&
  (value.base === null ||
    value.base === undefined ||
    typeof value.base === "string")

const fitsCollection = (record: SyncRecord) => {
  if (record.collection === "files" && filePath(record.id) !== record.id) {
    return false
  }

  if (record.deleted) {
    return true
  }

  switch (record.collection) {
    case "files":
      return isFileData(record.data)
    case "todos":
      return isTodo(record.data)
    case "events":
      return isCalendarEvent(record.data)
  }
}

const isSyncRecord = (value: unknown, now: number): value is SyncRecord =>
  isRecord(value) &&
  isText(value.collection) &&
  isSyncedCollection(value.collection) &&
  isText(value.id) &&
  typeof value.updatedAt === "number" &&
  !isPoisoned(value.updatedAt, now) &&
  typeof value.deleted === "boolean" &&
  isText(value.deviceId) &&
  fitsCollection(value as SyncRecord)

export type Received = { app: AppTag; records: SyncRecord[] }

export const readSnapshot = (text: string, now = Date.now()): Received => {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return { app: "eris", records: [] }
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.records)) {
    return { app: "eris", records: [] }
  }

  const app: AppTag = parsed.app === "note" ? "note" : "eris"

  const records = parsed.records
    .filter(r => isSyncRecord(r, now))
    .map(r => (r.deleted ? { ...r, data: null } : r))
    .filter(r => app === "note" || r.collection === "events")

  return { app, records }
}
