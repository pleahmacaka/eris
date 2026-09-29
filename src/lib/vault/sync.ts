import { type KeyValueStore, openStore } from "../platform/storage"
import { isPoisoned, remoteWins } from "../sync/merge"
import {
  type FileData,
  MAX_FILE,
  type SyncRecord,
  TOMBSTONE_TTL,
} from "../sync/protocol"
import { modifiedAt } from "./disk"
import { sameIgnoringCase } from "./paths"
import {
  readFile,
  refreshVault,
  removeExternal,
  vault,
  writeExternal,
} from "./vault.svelte"

type Stamp = {
  id: string
  updatedAt: number
  deviceId: string
  hash: string | null
  base: string | null
  deleted: boolean
}

const FILE = "files.json"
const ECHO = 3_000

const echoes = new Map<string, number>()

let handle: Promise<KeyValueStore> | undefined

const store = () => {
  handle ??= openStore(FILE)

  return handle
}

const keyOf = (path: string) => `${vault.root}|${path}`

const hashOf = async (text: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  )

  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

const next = (stamp: Stamp | undefined, at: number) =>
  Math.max(
    at,
    (stamp && !isPoisoned(stamp.updatedAt) ? stamp.updatedAt : 0) + 1,
  )

const editedAt = async (path: string, now: number) => {
  const mtime = await modifiedAt(vault.root, path).catch(() => null)

  return mtime === null ? now : Math.min(mtime, now)
}

export const isEcho = (path: string) => (echoes.get(path) ?? 0) > Date.now()

export type VaultScan = { records: SyncRecord[]; oversized: string[] }

// ponytail: every file is re-read and re-hashed on each publish; use stat mtime once vaults get large
export const vaultRecords = async (
  deviceId: string,
  now = Date.now(),
): Promise<VaultScan> => {
  const db = await store()
  const prefix = keyOf("")
  const known = new Map(
    (await db.entries<Stamp>())
      .filter(([key]) => key.startsWith(prefix))
      .map(([, stamp]) => [stamp.id, stamp]),
  )
  const records: SyncRecord[] = []
  const oversized: string[] = []
  const present = new Set<string>()

  for (const entry of vault.entries) {
    if (entry.folder) {
      continue
    }

    present.add(entry.path)

    const content = await readFile(entry.path)

    if (content.length > MAX_FILE) {
      oversized.push(entry.path)
      continue
    }

    const hash = await hashOf(content)
    let stamp = known.get(entry.path)

    if (!stamp || stamp.deleted || stamp.hash !== hash) {
      stamp = {
        id: entry.path,
        updatedAt: next(stamp, await editedAt(entry.path, now)),
        deviceId,
        hash,
        base: stamp?.hash ?? null,
        deleted: false,
      }
      await db.set(keyOf(entry.path), stamp)
    }

    records.push({
      collection: "files",
      id: entry.path,
      updatedAt: stamp.updatedAt,
      deviceId: stamp.deviceId,
      deleted: false,
      data: { content, base: stamp.base } satisfies FileData,
    })
  }

  for (const [path, previous] of known) {
    if (present.has(path)) {
      continue
    }

    let stamp = previous

    if (!stamp.deleted) {
      stamp = {
        id: path,
        updatedAt: next(stamp, now),
        deviceId,
        hash: null,
        base: stamp.hash,
        deleted: true,
      }
      await db.set(keyOf(path), stamp)
    }

    if (stamp.updatedAt < now - TOMBSTONE_TTL) {
      await db.delete(keyOf(path))
      continue
    }

    records.push({
      collection: "files",
      id: path,
      updatedAt: stamp.updatedAt,
      deviceId: stamp.deviceId,
      deleted: true,
      data: null,
    })
  }

  await db.save()

  return { records, oversized }
}

export const applyVaultRemote = async (
  records: SyncRecord[],
  deviceId: string,
) => {
  const db = await store()
  const changed: string[] = []

  for (const record of records) {
    if (record.collection !== "files") {
      continue
    }

    const path = record.id
    const local = await db.get<Stamp>(keyOf(path))
    const clash = vault.entries.some(
      e => e.path !== path && sameIgnoringCase(e.path, path),
    )

    if (clash || !remoteWins(record, local, deviceId)) {
      continue
    }

    echoes.set(path, Date.now() + ECHO)

    if (record.deleted) {
      await removeExternal(path)
    } else {
      await writeExternal(path, (record.data as FileData).content)
    }

    await db.set(keyOf(path), {
      id: path,
      updatedAt: record.updatedAt,
      deviceId: record.deviceId,
      hash: record.deleted
        ? null
        : await hashOf((record.data as FileData).content),
      base: null,
      deleted: record.deleted,
    } satisfies Stamp)

    changed.push(path)
  }

  await db.save()

  if (changed.length > 0) {
    await refreshVault()
  }

  return changed
}
