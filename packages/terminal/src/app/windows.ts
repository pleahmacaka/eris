import { invoke } from "@tauri-apps/api/core"
import type { Card } from "./drag.svelte"
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

export const hoverTab = (active: boolean, card: Card | null) =>
  invoke<void>("plugin:eris-terminal|drag_hover", { active, card })

export const registerHost = () =>
  invoke<void>("plugin:eris-terminal|register_host")
