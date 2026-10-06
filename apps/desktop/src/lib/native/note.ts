import { invoke } from "@tauri-apps/api/core"

export type NoteStatus = {
  installed: boolean
  vault: string | null
  linked: boolean
}

export type NotePage = { title: string; path: string }

export const noteLinkable = () => invoke<boolean>("note_linkable")

export const notePreview = (path: string) =>
  invoke<string>("note_preview", { path })

export const noteStatus = () => invoke<NoteStatus>("note_status")

export const notePages = (query: string) =>
  invoke<NotePage[]>("note_pages", { query })

export const noteBridgePublish = (snapshot: string) =>
  invoke<void>("note_bridge_publish", { snapshot })

export const noteBridgeRead = () => invoke<string | null>("note_bridge_read")
