import { emit, listen } from "@tauri-apps/api/event"
import { load, type Store } from "@tauri-apps/plugin-store"
import { loadDevice, type Profile, saveProfile } from "../settings"
import { type LocalItem, outboxKey, remoteWins, toLocal } from "../sync/merge"
import type {
  StoredRecord,
  SyncedCollection,
  SyncRecord,
} from "../sync/protocol"
import type { CalendarEvent, Note, Preset, Todo } from "./types"

export const DATA_EVENT = "data-changed"

export type DataChange = { collection: SyncedCollection }

export type SyncMeta = {
  cursors: Partial<Record<SyncedCollection, number>>
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
  replaceAll(items: T[]): Promise<void>
  subscribe(handler: (items: T[]) => void): () => void
}

const FILE = "data.json"
const META_KEY = "sync"
const OUTBOX_PREFIX = "outbox/"

const itemKey = (collection: SyncedCollection, id: string) =>
  `${collection}/${id}`

const outboxStoreKey = (record: Pick<SyncRecord, "collection" | "id">) =>
  `${OUTBOX_PREFIX}${outboxKey(record)}`

let handle: Promise<Store> | undefined

const store = () => {
  handle ??= load(FILE)

  return handle
}

const ownDeviceId = async () => (await loadDevice()).deviceId

const valuesByPrefix = async <T>(prefix: string) => {
  const entries = await (await store()).entries<T>()

  return entries.filter(([key]) => key.startsWith(prefix)).map(([, v]) => v)
}

const notify = (collection: SyncedCollection) =>
  emit(DATA_EVENT, { collection } satisfies DataChange)

const enqueue = async (record: SyncRecord) => {
  await (await store()).set(outboxStoreKey(record), record)
}

const stampFor = async (
  db: Store,
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
  listen<DataChange>(DATA_EVENT, e => handler(e.payload))

const collection = <T extends LocalItem>(
  name: SyncedCollection,
): Collection<T> => {
  const prefix = `${name}/`

  const all = async () => {
    const items = await valuesByPrefix<T>(prefix)

    return items.sort((a, b) => a.id.localeCompare(b.id))
  }

  const write = async (db: Store, item: T, device?: string) => {
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

    get: async id => (await store()).get<T>(itemKey(name, id)),

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

      await db.delete(itemKey(name, id))
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

    replaceAll: async items => {
      const db = await store()

      for (const key of await db.keys()) {
        if (key.startsWith(prefix)) {
          await db.delete(key)
        }
      }

      for (const item of items) {
        await db.set(itemKey(name, item.id), item)
      }

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

export const todos = collection<Todo>("todos")

export const events = collection<CalendarEvent>("events")

export const presets = collection<Preset>("presets")

export const notes = collection<Note>("notes")

export const newId = () => crypto.randomUUID()

export const saveProfileSynced = async (profile: Profile) => {
  await saveProfile(profile)

  const db = await store()
  const stamp = await stampFor(db, "profile", "profile")

  await db.set(itemKey("profile", "profile"), { id: "profile", ...stamp })
  await enqueue({
    collection: "profile",
    id: "profile",
    ...stamp,
    deleted: false,
    data: profile,
  })
  await db.save()
  await notify("profile")
}

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

// ponytail: get-then-write is not atomic across windows; a put landing mid-loop loses to the remote
export const applyRemote = async (
  records: StoredRecord[],
): Promise<SyncedCollection[]> => {
  const db = await store()
  const deviceId = await ownDeviceId()
  const changed = new Set<SyncedCollection>()
  let profile: Profile | null = null

  for (const record of records) {
    const key = itemKey(record.collection, record.id)
    const item = await db.get<LocalItem>(key)
    const pending = await db.get<SyncRecord>(outboxStoreKey(record))

    if (!remoteWins(record, item ?? pending, deviceId)) {
      continue
    }

    if (pending) {
      await db.delete(outboxStoreKey(record))
    }

    if (record.deleted) {
      if (!item) {
        continue
      }

      await db.delete(key)
    } else {
      await db.set(key, toLocal(record))

      if (record.collection === "profile") {
        profile = record.data as Profile
      }
    }

    changed.add(record.collection)
  }

  await db.save()

  if (profile) {
    await saveProfile(profile)
  }

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

// ponytail: get-then-delete is not atomic across windows; an edit landing in between is dropped from the outbox
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

export const cursorGroups = async (collections: SyncedCollection[]) => {
  const { cursors } = await syncMeta()
  const groups = new Map<number, SyncedCollection[]>()

  for (const name of collections) {
    const since = cursors[name] ?? 0

    groups.set(since, [...(groups.get(since) ?? []), name])
  }

  return [...groups].map(([since, names]) => ({ since, names }))
}

export const advanceCursors = async (
  collections: SyncedCollection[],
  seq: number,
) => {
  const { cursors } = await syncMeta()

  for (const name of collections) {
    cursors[name] = seq
  }

  return updateSyncMeta({ cursors })
}
