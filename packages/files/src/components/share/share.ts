import { invoke } from "@tauri-apps/api/core"

export type Device = { id: string; name: string; addedAt: number }

export type Item = { name: string; size: number; files: number; dir: boolean }

export type Manifest = {
  hash: string
  items: Item[]
  total: number
  from: string
}

export type Phase =
  | "waiting"
  | "receiving"
  | "offline"
  | "ready"
  | "done"
  | "failed"

export type Incoming = {
  id: string
  from: string
  manifest: Manifest | null
  phase: Phase
  receivedAt: number
  savedTo: string | null
  error: string | null
}

export type Download = { device: string; at: number }

export type Outgoing = {
  id: string
  hash: string
  items: Item[]
  total: number
  createdAt: number
  public: boolean
  devices: string[]
  expiresAt: number | null
  downloads: Download[]
  link: string
}

export type Sync = {
  id: string
  folder: string
  device: string
  paused: boolean
  linked: boolean
  createdAt: number
  syncedAt: number | null
  files: number
  error: string | null
}

export type SyncInvite = {
  id: string
  from: string
  name: string
  receivedAt: number
}

export type Safety = "ok" | "warn" | "blocked"

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
  shares: Outgoing[]
  inbox: Incoming[]
  pendingPair: string | null
  syncs: Sync[]
  syncInvites: SyncInvite[]
  senior: boolean
  browse: Browse
  browseAsks: Member[]
  members: Member[]
}

export type Invite = { code: string; link: string }

export type Progress = { id: string; done: number }

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

export const createShare = (paths: string[], expiresAt: number | null) =>
  invoke<Outgoing>("plugin:eris-files|share_create", { paths, expiresAt })

export const setPublic = (id: string, isPublic: boolean) =>
  invoke<void>("plugin:eris-files|share_set_public", { id, public: isPublic })

export const offer = (id: string, device: string) =>
  invoke<void>("plugin:eris-files|share_offer", { id, device })

export const setExpiry = (id: string, expiresAt: number | null) =>
  invoke<void>("plugin:eris-files|share_set_expiry", { id, expiresAt })

export const syncCheck = (folder: string) =>
  invoke<Safety>("plugin:eris-files|sync_check", { folder })

export const syncCreate = (folder: string, device: string) =>
  invoke<void>("plugin:eris-files|sync_create", { folder, device })

export const syncAccept = (id: string, folder: string) =>
  invoke<void>("plugin:eris-files|sync_accept", { id, folder })

export const syncDecline = (id: string) =>
  invoke<void>("plugin:eris-files|sync_decline", { id })

export const syncPause = (id: string, paused: boolean) =>
  invoke<void>("plugin:eris-files|sync_pause", { id, paused })

export const syncNow = (id: string) =>
  invoke<void>("plugin:eris-files|sync_now", { id })

export const syncRemove = (id: string) =>
  invoke<void>("plugin:eris-files|sync_remove", { id })

export const revoke = (id: string) =>
  invoke<void>("plugin:eris-files|share_revoke", { id })

export const openLink = (link: string) =>
  invoke<void>("plugin:eris-files|share_open", { link })

export const fetchShare = (id: string) =>
  invoke<void>("plugin:eris-files|share_fetch", { id })

export const download = (id: string, folder: string | null = null) =>
  invoke<void>("plugin:eris-files|share_download", { id, folder })

export const cancel = (id: string) =>
  invoke<void>("plugin:eris-files|share_cancel", { id })

export const dismiss = (id: string) =>
  invoke<void>("plugin:eris-files|share_dismiss", { id })

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
