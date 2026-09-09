import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

export type TrayIcon = {
  id: string
  tooltip: string
  icon: string | null
  hidden: boolean
  promoted: boolean
}

export const notifyIcons = () => invoke<TrayIcon[]>("notify_icons")

export const notifyIconClick = (id: string, button: "left" | "right") =>
  invoke<void>("notify_icon_click", { id, button })

export const notifyIconPromote = (id: string, promoted: boolean) =>
  invoke<void>("notify_icon_promote", { id, promoted })

export const onTrayIcons = (handler: () => void) =>
  listen("tray-icons", () => handler())
