import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

export type WindowEntry = {
  hwnd: number
  title: string
  process: string
  pid: number
  minimized: boolean
}

export type WindowLabel =
  | "main"
  | "taskbar"
  | "settings"
  | "panel"
  | "onboarding"
  | "chat"
  | "files"

export const listWindows = () => invoke<WindowEntry[]>("list_windows")

export const activateWindow = (hwnd: number) =>
  invoke<void>("activate_window", { hwnd })

export const closeWindow = (hwnd: number) =>
  invoke<void>("close_window", { hwnd })

export const minimizeWindow = (hwnd: number) =>
  invoke<void>("minimize_window", { hwnd })

export const previewShow = (windows: number[], center: number) =>
  invoke<void>("preview_show", { windows, center })

export const previewHide = () => invoke<void>("preview_hide")

export const showWindow = (label: WindowLabel) =>
  invoke<void>("show_window", { label })

export const hideWindow = (label: WindowLabel) =>
  invoke<void>("hide_window", { label })

export const toggleWindow = (label: WindowLabel) =>
  invoke<void>("toggle_window", { label })

export const onWindowShown = (label: WindowLabel, handler: () => void) =>
  listen<WindowLabel>("window-shown", event => {
    if (event.payload === label) {
      handler()
    }
  })

export type MonitorInfo = {
  id: string
  name: string
  primary: boolean
  x: number
  y: number
  width: number
  height: number
  scale: number
}

export const listMonitors = () => invoke<MonitorInfo[]>("list_monitors")
