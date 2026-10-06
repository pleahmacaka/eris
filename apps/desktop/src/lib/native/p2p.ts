import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

export type P2pPeer = {
  nodeId: string
  name: string
  lastSeen: number | null
  firstSeen: number | null
}

export type P2pStatus = {
  nodeId: string
  paired: boolean
  peers: P2pPeer[]
  removable: string[]
}

export const p2pStatus = () => invoke<P2pStatus>("p2p_status")

export const p2pInvite = (name: string) =>
  invoke<string>("p2p_invite", { name })

export const p2pJoin = (code: string, name: string) =>
  invoke<void>("p2p_join", { code, name })

export const p2pLeave = () => invoke<void>("p2p_leave")

export const p2pPublish = (snapshot: string) =>
  invoke<void>("p2p_publish", { snapshot })

export const p2pSync = () => invoke<number>("p2p_sync")

export const p2pRemove = (nodeId: string) =>
  invoke<void>("p2p_remove", { nodeId })

export const onP2pSnapshot = (handler: (snapshot: string) => void) =>
  listen<string>("p2p-snapshot", e => handler(e.payload))

export const onP2pPeers = (handler: () => void) =>
  listen("p2p-peers", () => handler())
