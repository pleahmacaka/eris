import { invoke } from "@tauri-apps/api/core"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import type { Handoff } from "./tabs.svelte"

export type Intent = { cwd: string | null; handoff: Handoff | null }

export const takeIntent = () =>
  invoke<Intent>("plugin:eris-terminal|take_intent")

export const newWindow = (
  cwd: string | null = null,
  handoff: Handoff | null = null,
) => invoke<void>("plugin:eris-terminal|new_window", { cwd, handoff })

export const tearOffTab = (handoff: Handoff, ptys: number[]) =>
  invoke<void>("plugin:eris-terminal|tear_off", { handoff, ptys })

export const acceptTabs = (adopt: (handoff: Handoff) => void) => {
  const stop = getCurrentWebviewWindow().listen<Handoff>(
    "eris-terminal:adopt",
    e => adopt(e.payload),
  )

  invoke("plugin:eris-terminal|register_host").catch(() => undefined)

  return () => {
    stop.then(unlisten => unlisten())
  }
}
