import type { CalendarEvent, Note, Preset, Todo } from "@eris/data"
import {
  loadDevice,
  loadProfile,
  type Profile,
  saveProfile,
  updateProfile,
} from "@eris/settings"
import {
  isPoisoned,
  type LocalItem,
  remoteWins,
  toLocal,
} from "@eris/sync/merge"
import {
  type SyncedCollection,
  type SyncRecord,
  TOMBSTONE_TTL,
} from "@eris/sync/protocol"
import { emit, listen } from "@tauri-apps/api/event"
import { load, type Store } from "@tauri-apps/plugin-store"

export const DATA_EVENT = "data-changed"

export type DataChange = { collection: SyncedCollection; remote: boolean }

export type SyncMeta = {
  lastSyncAt: number | null
  lastError: string | null
}

export type Collection<T extends LocalItem> = {
  name: SyncedCollection
  all(): Promise<T[]>
  get(id: string): Promise<T | undefined>
  put(item: T): Promise<T>
  apply(change: { put: T[]; remove: string[] }): Promise<void>
  remove(id: string): Promise<void>
  subscribe(handler: (items: T[]) => void): () => void
}

const FILE = "data.json"
const META_KEY = "sync"

const itemKey = (collection: SyncedCollection, id: string) =>
  `${collection}/${id}`

const tombstoneKey = (collection: SyncedCollection, id: string) =>
  `deleted/${collection}/${id}`

let handle: Promise<Store> | undefined

const store = () => {
  handle ??= load(FILE)

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
  emit(DATA_EVENT, { collection, remote } satisfies DataChange)

const lastStamp = (updatedAt: number | undefined) =>
  updatedAt === undefined || isPoisoned(updatedAt) ? 0 : updatedAt

const stampFor = async (
  db: Store,
  collection: SyncedCollection,
  id: string,
  device?: string,
) => {
  const [item, tombstone] = await Promise.all([
    db.get<LocalItem>(itemKey(collection, id)),
    db.get<SyncRecord>(tombstoneKey(collection, id)),
  ])

  return {
    updatedAt: Math.max(
      Date.now(),
      lastStamp(item?.updatedAt) + 1,
      lastStamp(tombstone?.updatedAt) + 1,
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
    await db.delete(tombstoneKey(name, stamped.id))

    return stamped
  }

  const bury = async (db: Store, id: string, device?: string) => {
    const stamp = await stampFor(db, name, id, device)

    await db.delete(itemKey(name, id))
    await db.set(tombstoneKey(name, id), {
      collection: name,
      id,
      ...stamp,
      deleted: true,
      data: null,
    } satisfies SyncRecord)
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

    apply: async change => {
      const db = await store()
      const device = await ownDeviceId()

      for (const item of change.put) {
        await write(db, item, device)
      }

      for (const id of change.remove) {
        await bury(db, id, device)
      }

      await db.save()
      await notify(name)
    },

    remove: async id => {
      const db = await store()

      await bury(db, id)
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

const stampProfile = async () => {
  const db = await store()
  const stamp = await stampFor(db, "profile", "profile")

  await db.set(itemKey("profile", "profile"), { id: "profile", ...stamp })
  await db.save()
  await notify("profile")
}

export const saveProfileSynced = async (profile: Profile) => {
  await saveProfile(profile)
  await stampProfile()
}

export const updateProfileSynced = async (
  change: (profile: Profile) => Profile,
) => {
  await updateProfile(change)
  await stampProfile()
}

export const localRecords = async (
  collections: readonly SyncedCollection[],
  now = Date.now(),
): Promise<SyncRecord[]> => {
  const db = await store()
  const entries = await db.entries()
  const deviceId = await ownDeviceId()
  const records: SyncRecord[] = []
  const expired: SyncRecord[] = []

  for (const name of collections) {
    const profile = name === "profile" ? await loadProfile() : null

    for (const item of prefixed<LocalItem>(entries, `${name}/`)) {
      records.push({
        collection: name,
        id: item.id,
        updatedAt: item.updatedAt,
        deviceId: item.deviceId ?? deviceId,
        deleted: false,
        data: profile ?? item,
      })
    }

    for (const tombstone of prefixed<SyncRecord>(
      entries,
      tombstoneKey(name, ""),
    )) {
      if (tombstone.updatedAt < now - TOMBSTONE_TTL) {
        expired.push(tombstone)
      } else {
        records.push(tombstone)
      }
    }
  }

  if (expired.length > 0) {
    for (const tombstone of expired) {
      await db.delete(tombstoneKey(tombstone.collection, tombstone.id))
    }

    await db.save()
  }

  return records
}

// ponytail: get-then-write is not atomic across windows; a put landing mid-loop loses to the remote
export const applyRemote = async (
  records: SyncRecord[],
): Promise<SyncedCollection[]> => {
  const db = await store()
  const deviceId = await ownDeviceId()
  const changed = new Set<SyncedCollection>()
  let profile: Profile | null = null

  for (const record of records) {
    const key = itemKey(record.collection, record.id)
    const dead = tombstoneKey(record.collection, record.id)
    const local =
      (await db.get<LocalItem>(key)) ?? (await db.get<SyncRecord>(dead))

    if (!remoteWins(record, local, deviceId)) {
      continue
    }

    if (record.deleted) {
      await db.delete(key)
      await db.set(dead, { ...record, data: null })
    } else {
      await db.set(key, toLocal(record))
      await db.delete(dead)

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
    await notify(name, true)
  }

  return [...changed]
}

export const syncMeta = async (): Promise<SyncMeta> => {
  const saved = await (await store()).get<Partial<SyncMeta>>(META_KEY)

  return {
    lastSyncAt: saved?.lastSyncAt ?? null,
    lastError: saved?.lastError ?? null,
  }
}

export const updateSyncMeta = async (patch: Partial<SyncMeta>) => {
  const db = await store()
  const next = { ...(await syncMeta()), ...patch }

  await db.set(META_KEY, next)
  await db.save()

  return next
}
