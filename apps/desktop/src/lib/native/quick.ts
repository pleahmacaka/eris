import { invoke } from "@tauri-apps/api/core"

export type RadioKind = "wifi" | "bluetooth" | "other"

export type RadioState = "on" | "off" | "disabled" | "unknown"

export type RadioInfo = { kind: RadioKind; state: RadioState }

export const radios = () => invoke<RadioInfo[]>("radios")

export const setRadio = (kind: RadioKind, on: boolean) =>
  invoke<void>("set_radio", { kind, on })

export const bluetoothDevices = () => invoke<string[]>("bluetooth_devices")

export type QuickAction =
  | "notifications"
  | "quicksettings"
  | "taskview"
  | "desktop"

export const quickAction = (action: QuickAction) =>
  invoke<void>("quick_action", { action })

export type InputLanguage = { label: string; layouts: number }

export const inputLanguage = () =>
  invoke<InputLanguage | null>("input_language")

export const cycleInputLanguage = () => invoke<void>("cycle_input_language")
