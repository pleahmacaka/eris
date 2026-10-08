import { invoke } from "@tauri-apps/api/core"
import type { Handoff } from "./tabs.svelte"

export type Intent = { cwd: string | null; handoff: Handoff | null }

export const takeIntent = () =>
  invoke<Intent>("plugin:eris-terminal|take_intent")

export const newWindow = (
  cwd: string | null = null,
  handoff: Handoff | null = null,
) => invoke<void>("plugin:eris-terminal|new_window", { cwd, handoff })
