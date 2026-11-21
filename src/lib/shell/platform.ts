import { isTauri } from "@tauri-apps/api/core"

export const isDesktopApp = () =>
  isTauri() && !/Android|iPhone|iPad/.test(navigator.userAgent)

export const isMac = () => navigator.userAgent.includes("Mac")
