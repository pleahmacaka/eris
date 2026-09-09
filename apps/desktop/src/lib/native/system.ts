import { invoke } from "@tauri-apps/api/core"

export type Battery = { percent: number; charging: boolean }

export type Volume = { level: number; muted: boolean }

export type SystemInfo = {
  battery: Battery | null
  volume: Volume | null
}

export type PowerAction =
  | "lock"
  | "sleep"
  | "hibernate"
  | "shutdown"
  | "restart"
  | "signout"

export const systemInfo = () => invoke<SystemInfo>("system_info")

export const powerAction = (action: PowerAction) =>
  invoke<void>("power_action", { action })

export const emptyRecycleBin = () => invoke<void>("empty_recycle_bin")

export const openUrl = (url: string) => invoke<void>("open_url", { url })

export const runCommand = (command: string) =>
  invoke<void>("run_command", { command })

export const machineName = () => invoke<string>("machine_name")

export const openDataFolder = () => invoke<void>("open_data_folder")

export type NetworkInfo = {
  kind: "wifi" | "ethernet" | "none"
  name: string
  connected: boolean
  ssid: string
  signal: number
}

export type Meters = {
  cpu: number
  memory: number
  memoryUsedMb: number
  memoryTotalMb: number
  network: NetworkInfo | null
}

export const systemMeters = () => invoke<Meters>("system_meters")
