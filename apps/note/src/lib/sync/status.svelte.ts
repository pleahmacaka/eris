import { syncMeta } from "../data/store"
import { p2pStatus, p2pSupported } from "../platform/p2p"

export type SyncState =
  | "unsupported"
  | "unpaired"
  | "syncing"
  | "idle"
  | "error"

export const sync = $state({
  state: "unpaired" as SyncState,
  lastSyncAt: null as number | null,
  lastError: null as string | null,
  peers: 0,
})

export const setSyncStatus = (patch: Partial<typeof sync>) => {
  Object.assign(sync, patch)
}

export const refreshPairing = async () => {
  const { paired, peers } = await p2pStatus()

  const state: SyncState = !paired
    ? "unpaired"
    : sync.state === "unpaired"
      ? "idle"
      : sync.state

  setSyncStatus({ state, peers: peers.length })
}

export const hydrateSyncStatus = async () => {
  if (!p2pSupported()) {
    setSyncStatus({ state: "unsupported" })

    return
  }

  const [meta, pairing] = await Promise.all([syncMeta(), p2pStatus()])

  setSyncStatus({
    state: !pairing.paired ? "unpaired" : meta.lastError ? "error" : "idle",
    lastSyncAt: meta.lastSyncAt,
    lastError: meta.lastError,
    peers: pairing.peers.length,
  })
}
