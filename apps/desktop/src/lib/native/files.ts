import { invoke } from "@tauri-apps/api/core"

export type FilesDefault = { supported: boolean; enabled: boolean }

export const filesDefault = (enable?: boolean) =>
  enable === undefined
    ? invoke<FilesDefault>("plugin:eris-files|default_app_status")
    : invoke<FilesDefault>("plugin:eris-files|set_default_app", {
        enabled: enable,
      })

export const openErisFiles = (path: string | null = null) =>
  invoke<void>("plugin:eris-files|new_window", { path })

export const openFilesDefaults = () =>
  invoke<void>("plugin:eris-files|open_default_apps")
