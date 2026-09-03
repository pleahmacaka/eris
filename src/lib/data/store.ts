import { publish, subscribe } from "../platform/events"
import { type KeyValueStore, openStore } from "../platform/storage"
import { loadDevice } from "../settings"
import { type LocalItem, outboxKey, remoteWins, toLocal } from "../sync/merge"
import type {
  StoredRecord,
  SyncedCollection,
  SyncRecord,
} from "../sync/protocol"
import type { CalendarEvent, Note, Todo } from "./types"

export const DATA_EVENT = "data-changed"

export type DataChange = { collection: SyncedCollection }

export type SyncMeta = {
  cursors: Record<string, number>
  lastSyncAt: number | null
  lastError: string | null
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
const OUTBOX_PREFIX = "outbox/"

const itemKey = (collection: SyncedCollection, id: string) =>
  `${collection}/${id}`

const outboxStoreKey = (record: Pick<SyncRecord, "collection" | "id">) =>
  `${OUTBOX_PREFIX}${outboxKey(record)}`

const cursorKey = (peerId: string, collection: SyncedCollection) =>
  `${peerId}:${collection}`

// ponytail: tombstones are never collected, revisit if the store grows
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

const valuesByPrefix = async <T>(prefix: string) => {
  const entries = await (await store()).entries<T>()

  return entries.filter(([key]) => key.startsWith(prefix)).map(([, v]) => v)
}

const notify = (collection: SyncedCollection) =>
  publish(DATA_EVENT, { collection } satisfies DataChange)

const enqueue = async (record: SyncRecord) => {
  await (await store()).set(outboxStoreKey(record), record)
}

const stampFor = async (
  db: KeyValueStore,
  collection: SyncedCollection,
  id: string,
  device?: string,
) => {
  const [item, pending] = await Promise.all([
    db.get<LocalItem>(itemKey(collection, id)),
    db.get<SyncRecord>(outboxStoreKey({ collection, id })),
  ])

  return {
    updatedAt: Math.max(
      Date.now(),
      (item?.updatedAt ?? 0) + 1,
      (pending?.updatedAt ?? 0) + 1,
    ),
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
    await enqueue({
      collection: name,
      id: stamped.id,
      updatedAt: stamped.updatedAt,
      deviceId: stamped.deviceId,
      deleted: false,
      data: stamped,
    })

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

      // a peer that missed the delete still serves the live row; without a
      // local tombstone the next pull resurrects it
      await db.set(itemKey(name, id), tombstone(id, stamp))
      await enqueue({
        collection: name,
        id,
        ...stamp,
        deleted: true,
        data: null,
      })
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

export const clearLocal = async (collections: SyncedCollection[]) => {
  const db = await store()
  const prefixes = collections.map(name => `${name}/`)

  for (const key of await db.keys()) {
    if (prefixes.some(prefix => key.startsWith(prefix))) {
      await db.delete(key)
    }
  }

  await db.save()

  for (const name of collections) {
    await notify(name)
  }
}

// a pulled record is re-queued so the next push carries it to the other peers;
// last-write-wins rejects it at the origin, which is what ends the hop
export const applyRemote = async (
  records: StoredRecord[],
  relay = true,
): Promise<SyncedCollection[]> => {
  const db = await store()
  const deviceId = await ownDeviceId()
  const changed = new Set<SyncedCollection>()

  for (const record of records) {
    const key = itemKey(record.collection, record.id)
    const item = await db.get<LocalItem>(key)
    const pending = await db.get<SyncRecord>(outboxStoreKey(record))

    if (!remoteWins(record, item ?? pending, deviceId)) {
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

    if (relay) {
      await enqueue({
        collection: record.collection,
        id: record.id,
        updatedAt: record.updatedAt,
        deleted: record.deleted,
        deviceId: record.deviceId,
        data: record.data ?? null,
      })
    } else if (pending) {
      await db.delete(outboxStoreKey(record))
    }

    changed.add(record.collection)
  }

  await db.save()

  for (const name of changed) {
    await notify(name)
  }

  return [...changed]
}

const handedOut = new Map<string, number>()

export const pendingOutbox = async () => {
  const { collections } = (await loadDevice()).sync
  const records = await valuesByPrefix<SyncRecord>(OUTBOX_PREFIX)

  return records.filter(r => collections[r.collection])
}

export const takeOutbox = async () => {
  const records = await pendingOutbox()

  for (const record of records) {
    handedOut.set(outboxKey(record), record.updatedAt)
  }

  return records
}

// ponytail: get-then-delete is not atomic; an edit landing in between is dropped
export const clearOutbox = async (keys: string[]) => {
  const db = await store()

  for (const key of keys) {
    const storeKey = `${OUTBOX_PREFIX}${key}`
    const current = await db.get<SyncRecord>(storeKey)
    const taken = handedOut.get(key) ?? Number.POSITIVE_INFINITY

    if (current && current.updatedAt <= taken) {
      await db.delete(storeKey)
    }

    handedOut.delete(key)
  }

  await db.save()
}

export const clearAllOutbox = async () => {
  const db = await store()

  for (const key of await db.keys()) {
    if (key.startsWith(OUTBOX_PREFIX)) {
      await db.delete(key)
    }
  }

  handedOut.clear()
  await db.save()
}

export const syncMeta = async (): Promise<SyncMeta> => ({
  cursors: {},
  lastSyncAt: null,
  lastError: null,
  ...(await (await store()).get<Partial<SyncMeta>>(META_KEY)),
})

export const updateSyncMeta = async (patch: Partial<SyncMeta>) => {
  const db = await store()
  const next = { ...(await syncMeta()), ...patch }

  await db.set(META_KEY, next)
  await db.save()

  return next
}

export const cursorGroups = async (
  peerId: string,
  collections: SyncedCollection[],
) => {
  const { cursors } = await syncMeta()
  const groups = new Map<number, SyncedCollection[]>()

  for (const name of collections) {
    const since = cursors[cursorKey(peerId, name)] ?? 0

    groups.set(since, [...(groups.get(since) ?? []), name])
  }

  return [...groups].map(([since, names]) => ({ since, names }))
}

export const advanceCursors = async (
  peerId: string,
  collections: SyncedCollection[],
  seq: number,
) => {
  const { cursors } = await syncMeta()

  for (const name of collections) {
    cursors[cursorKey(peerId, name)] = seq
  }

  return updateSyncMeta({ cursors })
}

export const resetCursors = async (peerId?: string) => {
  const { cursors } = await syncMeta()
  const kept = peerId
    ? Object.fromEntries(
        Object.entries(cursors).filter(
          ([key]) => !key.startsWith(`${peerId}:`),
        ),
      )
    : {}

  return updateSyncMeta({ cursors: kept })
}
