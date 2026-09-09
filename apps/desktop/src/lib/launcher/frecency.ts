import { load } from "@tauri-apps/plugin-store"

type Entry = { score: number; at: number }

const FILE = "launcher.json"
const KEY = "frecency"
const HALF_LIFE = 7 * 86_400_000

const entries = new Map<string, Entry>()
let loaded: Promise<void> | undefined

const decayed = (entry: Entry, now: number) =>
  entry.score * 0.5 ** ((now - entry.at) / HALF_LIFE)

export const loadFrecency = () => {
  loaded ??= load(FILE)
    .then(store => store.get<Record<string, Entry>>(KEY))
    .then(saved => {
      for (const [id, entry] of Object.entries(saved ?? {})) {
        entries.set(id, entry)
      }
    })
    .catch(() => undefined)

  return loaded
}

export const record = async (id: string) => {
  const now = Date.now()
  const current = entries.get(id)

  entries.set(id, {
    score: (current ? decayed(current, now) : 0) + 1,
    at: now,
  })

  const store = await load(FILE)

  await store.set(KEY, Object.fromEntries(entries))
  await store.save()
}

export const boost = (id: string, now = Date.now()) => {
  const entry = entries.get(id)

  return entry ? Math.min(150, 30 * Math.log2(1 + decayed(entry, now))) : 0
}

export const top = (count: number, now = Date.now()) =>
  [...entries.entries()]
    .map(([id, entry]) => ({ id, score: decayed(entry, now) }))
    .filter(e => e.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(e => e.id)
