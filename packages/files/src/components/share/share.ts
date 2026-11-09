import { invoke } from "@tauri-apps/api/core"

export type Device = { id: string; name: string; addedAt: number }

export type Scope = "drives" | "home" | "folders"

export type Browse = { scope: Scope; folders: string[]; always: string[] }

export type Member = { id: string; name: string }

export type RemoteEntry = {
  name: string
  path: string
  dir: boolean
  size: number
  modified: number
}

export type Browsed =
  | { kind: "listing"; path: string | null; entries: RemoteEntry[] }
  | { kind: "pending" }
  | { kind: "denied" }

export type ShareState = {
  name: string
  devices: Device[]
  pendingPair: string | null
  senior: boolean
  browse: Browse
  browseAsks: Member[]
  members: Member[]
}

export type Invite = { code: string; link: string }

export const shareState = () =>
  invoke<ShareState>("plugin:eris-files|share_state")

export const takeAttention = () =>
  invoke<boolean>("plugin:eris-files|share_take_attention")

export const renameSelf = (name: string) =>
  invoke<void>("plugin:eris-files|share_rename_self", { name })

export const invite = () => invoke<Invite>("plugin:eris-files|share_invite")

export const join = (code: string) =>
  invoke<void>("plugin:eris-files|share_join", { code })

export const dismissPair = () =>
  invoke<void>("plugin:eris-files|share_dismiss_pair")

export const renameDevice = (id: string, name: string) =>
  invoke<void>("plugin:eris-files|share_rename_device", { id, name })

export const removeDevice = (id: string) =>
  invoke<void>("plugin:eris-files|share_remove_device", { id })

export const browseDevice = (device: string, path: string | null) =>
  invoke<Browsed>("plugin:eris-files|share_browse", { device, path })

export const fetchRemote = (device: string, path: string) =>
  invoke<string | null>("plugin:eris-files|share_browse_fetch", {
    device,
    path,
  })

export const answerBrowse = (
  device: string,
  answer: "once" | "always" | "deny",
) => invoke<void>("plugin:eris-files|share_browse_answer", { device, answer })

export const revokeBrowse = (device: string) =>
  invoke<void>("plugin:eris-files|share_browse_revoke", { device })

export const setBrowseScope = (scope: Scope, folders: string[]) =>
  invoke<void>("plugin:eris-files|share_browse_scope", { scope, folders })

export const qr = (text: string) =>
  invoke<string>("plugin:eris-files|share_qr", { text })
