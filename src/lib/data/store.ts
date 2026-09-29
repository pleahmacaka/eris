import { publish, subscribe } from "../platform/events"
import { type KeyValueStore, openStore } from "../platform/storage"
import { loadDevice } from "../settings"
import { isPoisoned, type LocalItem, remoteWins, toLocal } from "../sync/merge"
import {
  type SyncedCollection,
  type SyncRecord,
  TOMBSTONE_TTL,
} from "../sync/protocol"
import type { CalendarEvent, Note, Todo } from "./types"

export const DATA_EVENT = "data-changed"

export type DataChange = { collection: SyncedCollection; remote: boolean }

export type SyncMeta = {
  lastSyncAt: number | null
  lastError: string | null
  importedInto: string[]
}

export type Collection<T extends LocalItem> = {
  name: SyncedCollection
  all(): Promise<T[]>
  get(id: string): Promise<T | undefined>
  put(item: T): Promise<T>
  putMany(items: T[]): Promise<void>
  remove(id: string): Promise<void>
  subscribe(handler: (items: T[]) => void): () => void
}

const FILE = "data.json"
const META_KEY = "sync"

const itemKey = (collection: SyncedCollection, id: string) =>
  `${collection}/${id}`

type Buried = LocalItem & { deleted: true }

const buried = (item: LocalItem | undefined): item is Buried =>
  (item as Buried | undefined)?.deleted === true

const tombstone = (
  id: string,
  stamp: { updatedAt: number; deviceId: string },
): Buried => ({ id, ...stamp, deleted: true })

let handle: Promise<KeyValueStore> | undefined

const store = () => {
  handle ??= openStore(FILE)

  return handle
}

const ownDeviceId = async () => (await loadDevice()).deviceId

const prefixed = <T>(entries: [string, unknown][], prefix: string) =>
  entries
    .filter(([key]) => key.startsWith(prefix))
    .map(([, value]) => value as T)

const valuesByPrefix = async <T>(prefix: string) =>
  prefixed<T>(await (await store()).entries(), prefix)

const notify = (collection: SyncedCollection, remote = false) =>
  publish(DATA_EVENT, { collection, remote } satisfies DataChange)

const lastStamp = (updatedAt: number | undefined) =>
  updatedAt === undefined || isPoisoned(updatedAt) ? 0 : updatedAt

const stampFor = async (
  db: KeyValueStore,
  collection: SyncedCollection,
  id: string,
  device?: string,
) => {
  const item = await db.get<LocalItem>(itemKey(collection, id))

  return {
    updatedAt: Math.max(Date.now(), lastStamp(item?.updatedAt) + 1),
    deviceId: device ?? (await ownDeviceId()),
  }
}

export const onDataChange = (handler: (change: DataChange) => void) =>
  subscribe<DataChange>(DATA_EVENT, handler)

const collection = <T extends LocalItem>(
  name: SyncedCollection,
): Collection<T> => {
  const prefix = `${name}/`

  const all = async () => {
    const items = await valuesByPrefix<T>(prefix)

    return items
      .filter(item => !buried(item))
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  const write = async (db: KeyValueStore, item: T, device?: string) => {
    const stamped = { ...item, ...(await stampFor(db, name, item.id, device)) }

    await db.set(itemKey(name, stamped.id), stamped)

    return stamped
  }

  return {
    name,
    all,

    get: async id => {
      const item = await (await store()).get<T>(itemKey(name, id))

      return buried(item) ? undefined : item
    },

    put: async item => {
      const db = await store()
      const stamped = await write(db, item)

      await db.save()
      await notify(name)

      return stamped
    },

    putMany: async items => {
      const db = await store()
      const device = await ownDeviceId()

      for (const item of items) {
        await write(db, item, device)
      }

      await db.save()
      await notify(name)
    },

    remove: async id => {
      const db = await store()
      const stamp = await stampFor(db, name, id)

      await db.set(itemKey(name, id), tombstone(id, stamp))
      await db.save()
      await notify(name)
    },

    subscribe: handler => {
      let stopped = false
      let unlisten: (() => void) | undefined

      const push = () => {
        all().then(items => {
          if (!stopped) {
            handler(items)
          }
        })
      }

      push()
      onDataChange(change => {
        if (change.collection === name) {
          push()
        }
      }).then(fn => {
        if (stopped) {
          fn()
        } else {
          unlisten = fn
        }
      })

      return () => {
        stopped = true
        unlisten?.()
      }
    },
  }
}

export const notes = collection<Note>("notes")

export const todos = collection<Todo>("todos")

export const events = collection<CalendarEvent>("events")

export const newId = () => crypto.randomUUID()

export const localRecords = async (
  collections: readonly SyncedCollection[],
  now = Date.now(),
): Promise<SyncRecord[]> => {
  const db = await store()
  const entries = await db.entries()
  const deviceId = await ownDeviceId()
  const records: SyncRecord[] = []
  const expired: string[] = []

  for (const name of collections) {
    for (const item of prefixed<LocalItem>(entries, `${name}/`)) {
      const record = {
        collection: name,
        id: item.id,
        updatedAt: item.updatedAt,
        deviceId: item.deviceId ?? deviceId,
      }

      if (!buried(item)) {
        records.push({ ...record, deleted: false, data: item })
      } else if (item.updatedAt < now - TOMBSTONE_TTL) {
        expired.push(itemKey(name, item.id))
      } else {
        records.push({ ...record, deleted: true, data: null })
      }
    }
  }

  if (expired.length > 0) {
    for (const key of expired) {
      await db.delete(key)
    }

    await db.save()
  }

  return records
}

// ponytail: get-then-write is not atomic; a put landing mid-loop loses to the remote
export const applyRemote = async (
  records: SyncRecord[],
): Promise<SyncedCollection[]> => {
  const db = await store()
  const deviceId = await ownDeviceId()
  const changed = new Set<SyncedCollection>()

  for (const record of records) {
    const key = itemKey(record.collection, record.id)

    if (!remoteWins(record, await db.get<LocalItem>(key), deviceId)) {
      continue
    }

    if (record.deleted) {
      await db.set(
        key,
        tombstone(record.id, {
          updatedAt: record.updatedAt,
          deviceId: record.deviceId,
        }),
      )
    } else {
      await db.set(key, toLocal(record))
    }

    changed.add(record.collection)
  }

  await db.save()

  for (const name of changed) {
    await notify(name, true)
  }

  return [...changed]
}

export const syncMeta = async (): Promise<SyncMeta> => {
  const saved = await (await store()).get<Partial<SyncMeta>>(META_KEY)

  return {
    lastSyncAt: saved?.lastSyncAt ?? null,
    lastError: saved?.lastError ?? null,
    importedInto: saved?.importedInto ?? [],
  }
}

export const updateSyncMeta = async (patch: Partial<SyncMeta>) => {
  const db = await store()
  const next = { ...(await syncMeta()), ...patch }

  await db.set(META_KEY, next)
  await db.save()

  return next
}
