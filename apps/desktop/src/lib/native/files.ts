import { invoke } from "@tauri-apps/api/core"

export type FileEntry = {
  name: string
  path: string
  directory: boolean
  size: number
  modified: number
  hidden: boolean
}

export type FilePlace = {
  name: string
  path: string
  kind: "folder" | "drive"
  free: number
  total: number
}

export type FileListing = {
  path: string
  parent: string | null
  entries: FileEntry[]
}

export const listDir = (path: string) =>
  invoke<FileListing>("list_dir", { path })

export const filePlaces = () => invoke<FilePlace[]>("file_places")

export const searchDir = (root: string, query: string) =>
  invoke<FileEntry[]>("search_dir", { root, query })

export const createFolder = (path: string, name: string) =>
  invoke<string>("create_folder", { path, name })

export const renameEntry = (path: string, name: string) =>
  invoke<string>("rename_entry", { path, name })

export const deleteEntries = (paths: string[], permanent = false) =>
  invoke<void>("delete_entries", { paths, permanent })

export const transferEntries = (
  paths: string[],
  target: string,
  cut: boolean,
) => invoke<void>("transfer_entries", { paths, target, cut })
