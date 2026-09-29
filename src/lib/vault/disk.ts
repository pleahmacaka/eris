import { appDataDir, join as joinPath, sep } from "@tauri-apps/api/path"
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  stat,
  watch,
  writeTextFile,
} from "@tauri-apps/plugin-fs"
import { dirname, filePath, folderPath, join } from "./paths"

export type Entry = { path: string; folder: boolean }

export const defaultRoot = async () => joinPath(await appDataDir(), "vault")

const absolute = (root: string, path: string) =>
  path === "" ? root : [root, ...path.split("/")].join(sep())

const relative = (root: string, absolutePath: string) => {
  if (!absolutePath.startsWith(root)) {
    return null
  }

  return absolutePath
    .slice(root.length)
    .split(/[\\/]/)
    .filter(Boolean)
    .join("/")
}

const guarded = (path: string, folder: boolean) => {
  const safe = folder ? folderPath(path) : filePath(path)

  if (safe === null) {
    throw new Error(`허용되지 않는 경로: ${path}`)
  }

  return safe
}

export const listEntries = async (
  root: string,
  folder = "",
): Promise<Entry[]> => {
  const entries: Entry[] = []

  for (const item of await readDir(absolute(root, folder))) {
    if (item.isSymlink) {
      continue
    }

    const path = join(folder, item.name)

    if (item.isDirectory && folderPath(path) !== null) {
      entries.push({ path, folder: true })
      entries.push(...(await listEntries(root, path)))
    } else if (item.isFile && filePath(path) !== null) {
      entries.push({ path, folder: false })
    }
  }

  return entries
}

export const ensureRoot = async (root: string) => {
  if (!(await exists(root))) {
    await mkdir(root, { recursive: true })
  }
}

export const readText = (root: string, path: string) =>
  readTextFile(absolute(root, guarded(path, false)))

export const writeText = async (root: string, path: string, text: string) => {
  const safe = guarded(path, false)
  const parent = dirname(safe)

  if (parent !== "") {
    await mkdir(absolute(root, parent), { recursive: true })
  }

  await writeTextFile(absolute(root, safe), text)
}

export const modifiedAt = async (root: string, path: string) =>
  (await stat(absolute(root, guarded(path, false)))).mtime?.getTime() ?? null

export const makeFolder = (root: string, path: string) =>
  mkdir(absolute(root, guarded(path, true)), { recursive: true })

export const move = async (
  root: string,
  from: string,
  to: string,
  folder: boolean,
) => {
  const target = guarded(to, folder)
  const parent = dirname(target)

  if (parent !== "") {
    await mkdir(absolute(root, parent), { recursive: true })
  }

  await rename(absolute(root, guarded(from, folder)), absolute(root, target))
}

export const erase = (root: string, path: string, folder: boolean) =>
  remove(absolute(root, guarded(path, folder)), { recursive: folder })

export const watchRoot = (root: string, handler: (paths: string[]) => void) =>
  watch(
    root,
    e => {
      handler(
        e.paths
          .map(p => relative(root, p))
          .filter((p): p is string => p !== null),
      )
    },
    { recursive: true, delayMs: 300 },
  )
