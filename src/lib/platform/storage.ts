import { isTauri } from "./runtime"

export type KeyValueStore = {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<boolean>
  keys(): Promise<string[]>
  entries<T>(): Promise<[string, T][]>
  save(): Promise<void>
}

const webStore = (file: string): KeyValueStore => {
  const prefix = `arixlab-note/${file}/`

  const read = <T>(key: string) => {
    const raw = localStorage.getItem(prefix + key)

    return raw === null ? undefined : (JSON.parse(raw) as T)
  }

  const names = () =>
    Object.keys(localStorage)
      .filter(key => key.startsWith(prefix))
      .map(key => key.slice(prefix.length))

  return {
    get: async key => read(key),

    set: async (key, value) => {
      localStorage.setItem(prefix + key, JSON.stringify(value))
    },

    delete: async key => {
      const existed = localStorage.getItem(prefix + key) !== null

      localStorage.removeItem(prefix + key)

      return existed
    },

    keys: async () => names(),

    entries: async <T>() =>
      names().map(key => [key, read<T>(key) as T] satisfies [string, T]),

    save: async () => {},
  }
}

export const openStore = async (file: string): Promise<KeyValueStore> => {
  if (!isTauri()) {
    return webStore(file)
  }

  const { load } = await import("@tauri-apps/plugin-store")

  return (await load(file)) as unknown as KeyValueStore
}
