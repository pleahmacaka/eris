import conf from "../../../src-tauri/tauri.conf.json"

type WindowConfig = {
  label: string
  url: string
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  resizable?: boolean
}

export type Surface = {
  label: string
  url: string
  width: number
  height: number
  minWidth: number
  minHeight: number
  resizable: boolean
}

export const BARS = ["taskbar", "topbar"]

const windows: WindowConfig[] = conf.app.windows

export const surfaces: Surface[] = windows.map(w => ({
  label: w.label,
  url: w.url,
  width: w.width,
  height: w.height,
  minWidth: w.minWidth ?? w.width,
  minHeight: w.minHeight ?? w.height,
  resizable: w.resizable ?? false,
}))

export const labelFor = (path: string) =>
  surfaces.find(s => s.url === path)?.label ?? (path.split("/")[1] || "main")
