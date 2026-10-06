import { listen } from "@tauri-apps/api/event"
import {
  type Progress,
  type ShareState,
  shareState,
  takeAttention,
} from "./share"

export const share = $state<{
  state: ShareState
  problem: string | null
  progress: Record<string, number>
  paths: string[] | null
  center: boolean
  syncFolder: string | null
}>({
  state: {
    name: "",
    devices: [],
    shares: [],
    inbox: [],
    pendingPair: null,
    syncs: [],
    syncInvites: [],
    senior: false,
    browse: { scope: "drives", folders: [], always: [] },
    browseAsks: [],
    members: [],
  },
  problem: null,
  progress: {},
  paths: null,
  center: false,
  syncFolder: null,
})

const refresh = async () => {
  try {
    share.state = await shareState()
    share.problem = null
  } catch (reason) {
    share.problem = String(reason)

    return
  }

  const receiving = new Set(
    share.state.inbox
      .filter(entry => entry.phase === "receiving")
      .map(entry => entry.id),
  )

  for (const id of Object.keys(share.progress)) {
    if (!receiving.has(id)) {
      delete share.progress[id]
    }
  }

  if (await takeAttention()) {
    share.center = true
  }
}

export const reloadShare = () => {
  refresh().catch(() => undefined)
}

export const startShare = () => {
  reloadShare()

  const stops = [
    listen("share-changed", reloadShare),
    listen<Progress>("share-progress", e => {
      share.progress[e.payload.id] = e.payload.done
    }),
  ]

  return () => {
    for (const stop of stops) {
      stop.then(unlisten => unlisten())
    }
  }
}

export const openShare = (paths: string[]) => {
  share.paths = paths
}

const deviceName = (id: string | null) =>
  share.state.devices.find(device => device.id === id)?.name ?? ""

export const peerName = (id: string, fallback = "") =>
  deviceName(id) || fallback || id.slice(0, 8)
