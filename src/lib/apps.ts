import { invoke } from "@tauri-apps/api/core"

export type AppEntry = { name: string; path: string }

const icons = new Map<string, Promise<string | null>>()

export const listApps = () => invoke<AppEntry[]>("list_apps")

export const launchApp = (path: string) => invoke<void>("launch_app", { path })

export const appIcon = (path: string) => {
  const cached = icons.get(path)

  if (cached) {
    return cached
  }

  const pending = invoke<string | null>("app_icon", { path }).catch(() => null)
  icons.set(path, pending)

  return pending
}
