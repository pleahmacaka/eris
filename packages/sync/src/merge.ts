import { crossesApps, MAX_CLOCK_SKEW } from "@eris/bridge"
import { isSyncedCollection, type SyncRecord } from "./protocol"

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
): LocalItem & Record<string, unknown> => {
  const data =
    record.collection === "profile" ? {} : ((record.data as object) ?? {})

  return {
    ...data,
    id: record.id,
    updatedAt: record.updatedAt,
    deviceId: record.deviceId,
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isText = (value: unknown): value is string =>
  typeof value === "string" && value !== ""

const isSyncRecord = (value: unknown, now: number): value is SyncRecord =>
  isObject(value) &&
  isText(value.collection) &&
  isSyncedCollection(value.collection) &&
  isText(value.id) &&
  typeof value.updatedAt === "number" &&
  !isPoisoned(value.updatedAt, now) &&
  typeof value.deleted === "boolean" &&
  isText(value.deviceId) &&
  (value.deleted || isObject(value.data))

export const readSnapshot = (text: string, now = Date.now()): SyncRecord[] => {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }

  if (!isObject(parsed) || !Array.isArray(parsed.records)) {
    return []
  }

  const foreign = parsed.app !== undefined && parsed.app !== "eris"

  return parsed.records.filter(
    r => isSyncRecord(r, now) && (!foreign || crossesApps(r.collection)),
  )
}
