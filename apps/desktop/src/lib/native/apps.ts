import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

export type AppKind = "shortcut" | "store" | "exe"

export type AppEntry = {
  id: string
  name: string
  path: string
  kind: AppKind
  subtitle: string
}

export const listApps = () => invoke<AppEntry[]>("list_apps")

export const onAppsChanged = (run: () => void) => listen("apps-changed", run)

export const pinnedApps = () => invoke<AppEntry[]>("pinned_apps")

export const reorderPins = (paths: string[]) =>
  invoke<void>("reorder_pins", { paths })

export const launchApp = (path: string, admin = false) =>
  invoke<void>("launch_app", { path, admin })

export const openLocation = (path: string) =>
  invoke<void>("open_location", { path })

export const appIcon = (path: string) =>
  invoke<string | null>("app_icon", { path })

export const clearIconCache = () => invoke<void>("clear_icon_cache")
