import { invoke } from "@tauri-apps/api/core"

export const noteLinkable = () => invoke<boolean>("note_linkable")

export const notePreview = (path: string) =>
  invoke<string>("note_preview", { path })
