import { invoke } from "@tauri-apps/api/core"

export type Intent = { cwd: string | null }

export const takeIntent = () =>
  invoke<Intent>("plugin:eris-terminal|take_intent")

export const newWindow = (cwd: string | null = null) =>
  invoke<void>("plugin:eris-terminal|new_window", { cwd })
