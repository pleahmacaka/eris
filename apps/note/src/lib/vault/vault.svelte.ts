import { SvelteMap } from "svelte/reactivity"
import {
  defaultRoot,
  type Entry,
  ensureRoot,
  erase,
  listEntries,
  makeFolder,
  move,
  readText,
  watchRoot,
  writeText,
} from "./disk"
import {
  basename,
  dirname,
  extension,
  isCanvas,
  isNote,
  join,
  safeName,
  sameIgnoringCase,
  stem,
} from "./paths"

export type VaultChange = { paths: string[]; external: boolean }

export const vault = $state({
  root: "",
  entries: [] as Entry[],
  ready: false,
  error: null as string | null,
})

export const texts = new SvelteMap<string, string>()

const listeners = new Set<(change: VaultChange) => void>()

let unwatch: (() => void) | null = null

const emit = (change: VaultChange) => {
  for (const listener of listeners) {
    listener(change)
  }
}

export const onVaultChange = (listener: (change: VaultChange) => void) => {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

// ponytail: every note is held in memory for links and search; revisit past a few thousand notes
const rescan = async () => {
  const entries = await listEntries(vault.root)
  const present = new Set(entries.map(e => e.path))

  vault.entries = entries

  for (const path of [...texts.keys()]) {
    if (!present.has(path)) {
      texts.delete(path)
    }
  }

  for (const entry of entries) {
    if (!entry.folder && isNote(entry.path) && !texts.has(entry.path)) {
      texts.set(entry.path, await readText(vault.root, entry.path))
    }
  }
}

const listing = () =>
  vault.entries
    .map(e => e.path)
    .sort()
    .join("\n")

const reloadExternal = async (paths: string[]) => {
  const before = listing()

  await rescan()

  const changed = paths.filter(path => isCanvas(path))

  for (const path of paths) {
    if (!texts.has(path)) {
      continue
    }

    const text = await readText(vault.root, path)

    if (texts.get(path) !== text) {
      texts.set(path, text)
      changed.push(path)
    }
  }

  if (changed.length > 0 || listing() !== before) {
    emit({ paths: changed.length > 0 ? changed : paths, external: true })
  }
}

let opened: () => void = () => {}

let opening = new Promise<void>(resolve => {
  opened = resolve
})

export const whenOpen = () => opening

const open = async (custom: string | null) => {
  unwatch?.()
  unwatch = null
  vault.ready = false
  vault.error = null
  texts.clear()

  try {
    const root = custom ?? (await defaultRoot())

    await ensureRoot(root)
    vault.root = root
    await rescan()
    unwatch = await watchRoot(root, paths => {
      reloadExternal(paths).catch(() => undefined)
    })
  } catch (error) {
    vault.error = error instanceof Error ? error.message : String(error)
  } finally {
    vault.ready = true
  }
}

export const openVault = (custom: string | null) => {
  opening = open(custom).finally(opened)

  return opening
}

export const readFile = async (path: string) => {
  await opening

  return texts.get(path) ?? readText(vault.root, path)
}

export const saveFile = async (path: string, text: string) => {
  const root = vault.root

  await opening

  if (root !== "" && root !== vault.root) {
    return
  }

  if (isNote(path)) {
    texts.set(path, text)
  }

  await writeText(vault.root, path, text)
  emit({ paths: [path], external: false })
}

const taken = (path: string, except?: string) =>
  vault.entries.some(e => e.path !== except && sameIgnoringCase(e.path, path))

export const uniquePath = (folder: string, name: string, ext: string) => {
  const base = safeName(name) || "제목 없음"

  for (let n = 0; ; n++) {
    const path = join(folder, `${n === 0 ? base : `${base} ${n}`}${ext}`)

    if (!taken(path)) {
      return path
    }
  }
}

export const createFile = async (
  folder: string,
  name: string,
  ext: ".md" | ".mdx" | ".canvas",
  text = "",
) => {
  const path = uniquePath(folder, name, ext)

  await saveFile(path, text)
  await rescan()

  return path
}

export const createFolder = async (parent: string, name: string) => {
  const path = uniquePath(parent, name, "")

  await makeFolder(vault.root, path)
  await rescan()

  return path
}

export const renamePath = async (path: string, name: string) => {
  const folder = vault.entries.find(e => e.path === path)?.folder ?? false
  const ext = folder ? "" : extension(path)
  const next = join(dirname(path), `${safeName(name)}${ext}`)

  if (next === path || stem(next) === "") {
    return path
  }

  return relocate(path, next, folder)
}

const relocate = async (path: string, next: string, folder: boolean) => {
  if (taken(next, path)) {
    throw new Error(`이미 있는 이름: ${basename(next)}`)
  }

  await move(vault.root, path, next, folder)

  for (const [key, text] of [...texts]) {
    if (key === path || key.startsWith(`${path}/`)) {
      texts.delete(key)
      texts.set(next + key.slice(path.length), text)
    }
  }

  await rescan()
  emit({ paths: [path, next], external: false })

  return next
}

export const movePath = async (path: string, folder: string) => {
  const entry = vault.entries.find(e => e.path === path)
  const next = join(folder, basename(path))

  if (
    !entry ||
    next === path ||
    folder === path ||
    folder.startsWith(`${path}/`)
  ) {
    return path
  }

  return relocate(path, next, entry.folder)
}

export const refreshVault = rescan

export const writeExternal = async (path: string, text: string) => {
  if (isNote(path)) {
    texts.set(path, text)
  }

  await writeText(vault.root, path, text)
  emit({ paths: [path], external: true })
}

export const removeExternal = async (path: string) => {
  if (!vault.entries.some(e => e.path === path && !e.folder)) {
    return
  }

  texts.delete(path)
  await erase(vault.root, path, false)
  emit({ paths: [path], external: true })
}

export const removePath = async (path: string) => {
  const folder = vault.entries.find(e => e.path === path)?.folder ?? false

  await erase(vault.root, path, folder)
  await rescan()
  emit({ paths: [path], external: false })
}
