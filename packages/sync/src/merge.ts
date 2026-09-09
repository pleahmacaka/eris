import type { SyncRecord } from "./protocol"

export type Versioned = { updatedAt: number; deviceId?: string }

export type LocalItem = Versioned & { id: string }

export const outboxKey = (record: Pick<SyncRecord, "collection" | "id">) =>
  `${record.collection}:${record.id}`

export const remoteWins = (
  remote: Pick<SyncRecord, "updatedAt" | "deviceId">,
  local: Versioned | undefined,
  ownDeviceId: string,
) =>
  !local ||
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
