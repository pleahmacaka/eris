import { isTauri } from "./runtime"

export type P2pPeer = {
  nodeId: string
  name: string
  lastSeen: number | null
}

export type P2pStatus = {
  nodeId: string
  paired: boolean
  peers: P2pPeer[]
}

export const p2pSupported = isTauri

const call = async <T>(command: string, args?: Record<string, unknown>) => {
  const { invoke } = await import("@tauri-apps/api/core")

  return invoke<T>(command, args)
}

const listenTo = async <T>(name: string, handler: (payload: T) => void) => {
  if (!isTauri()) {
    return () => {}
  }

  const { listen } = await import("@tauri-apps/api/event")

  return listen<T>(name, e => handler(e.payload))
}

export const p2pStatus = () => call<P2pStatus>("p2p_status")

export const p2pInvite = (name: string) => call<string>("p2p_invite", { name })

export const p2pJoin = (code: string, name: string) =>
  call<void>("p2p_join", { code, name })

export const p2pLeave = () => call<void>("p2p_leave")

export const p2pPublish = (snapshot: string) =>
  call<void>("p2p_publish", { snapshot })

export const p2pSync = () => call<number>("p2p_sync")

export const onP2pSnapshot = (handler: (snapshot: string) => void) =>
  listenTo<string>("p2p-snapshot", handler)

export const onP2pPeers = (handler: () => void) =>
  listenTo<null>("p2p-peers", () => handler())
