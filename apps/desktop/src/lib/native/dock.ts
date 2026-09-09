import type { Features } from "@eris/settings"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

export type TaskbarLayout = {
  edge: "bottom" | "top"
  height: number
  width: number
  floating: boolean
  autoHide: boolean
  hideSystemTaskbar: boolean
  monitor?: string | null
  desktop?: boolean
}

export const extendTaskbar = (px: number) =>
  invoke<void>("extend_taskbar", { px })

export const applyTaskbar = (layout: TaskbarLayout) =>
  invoke<void>("apply_taskbar", { layout })

export const setWinKeyCapture = (enabled: boolean) =>
  invoke<void>("set_win_key_capture", { enabled })

export const setLauncherShortcut = (shortcut: string | null) =>
  invoke<void>("set_launcher_shortcut", { shortcut })

export const setChatShortcut = (shortcut: string | null) =>
  invoke<void>("set_chat_shortcut", { shortcut })

export const setFeatures = (features: Features) =>
  invoke<void>("set_features", { features })

export const onDockEdge = (handler: (atEdge: boolean) => void) =>
  listen<{ atEdge: boolean }>("dock-edge", e => handler(e.payload.atEdge))

export const onDockFullscreen = (handler: (fullscreen: boolean) => void) =>
  listen<{ fullscreen: boolean }>("dock-fullscreen", e =>
    handler(e.payload.fullscreen),
  )

export const editMode = (on: boolean) => invoke<void>("edit_mode", { on })

export const editRaise = () => invoke<void>("edit_raise")
