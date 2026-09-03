import type { Peer } from "./protocol"

export type PeerState = "unknown" | "online" | "offline"

export type PeerStatus = {
  id: string
  label: string
  url: string
  role: Peer["role"]
  state: PeerState
  seq: number | null
  latencyMs: number | null
  lastError: string | null
}

export type SyncState = "disabled" | "idle" | "syncing" | "error"

export const sync = $state({
  state: "disabled" as SyncState,
  lastSyncAt: null as number | null,
  lastError: null as string | null,
  pending: 0,
  peers: [] as PeerStatus[],
})

export const setSyncStatus = (patch: Partial<typeof sync>) => {
  Object.assign(sync, patch)
}

export const setPeerStatus = (status: PeerStatus) => {
  const at = sync.peers.findIndex(p => p.id === status.id)

  sync.peers =
    at === -1
      ? [...sync.peers, status]
      : sync.peers.map(p => (p.id === status.id ? status : p))
}

export const dropPeerStatus = (id: string) => {
  sync.peers = sync.peers.filter(p => p.id !== id)
}
