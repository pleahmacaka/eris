import {
  clearAllOutbox,
  clearLocal,
  resetCursors,
  updateSyncMeta,
} from "../data/store"
import { ensureDevice } from "../device"
import {
  loadDevice,
  patchDevice,
  patchSync,
  saveDevice,
  upsertPeer,
} from "../settings"
import { probe, syncNow } from "./engine"
import { normalizeUrl, syncedCollections } from "./protocol"
import { setSyncStatus } from "./status.svelte"

export type Credentials = {
  url: string
  token: string
  label: string
  deviceName: string
}

export const signIn = async ({
  url,
  token,
  label,
  deviceName,
}: Credentials) => {
  const address = normalizeUrl(url)

  await probe({ url: address, token })

  const device = await ensureDevice()

  if (deviceName.trim() && deviceName.trim() !== device.deviceName) {
    await patchDevice({ deviceName: deviceName.trim() })
  }

  await upsertPeer({
    label: label.trim() || new URL(address).host,
    url: address,
    token: token.trim(),
    role: "hub",
    enabled: true,
  })

  await patchSync({ enabled: true })
  await syncNow()
}

export const signedIn = (peers: { length: number }) => peers.length > 0

export const signOut = async (wipeLocal: boolean) => {
  const device = await loadDevice()

  await saveDevice({
    ...device,
    sync: { ...device.sync, enabled: false, peers: [] },
  })

  await clearAllOutbox()
  await resetCursors()
  await updateSyncMeta({ lastSyncAt: null, lastError: null })

  if (wipeLocal) {
    await clearLocal([...syncedCollections])
  }

  setSyncStatus({
    state: "disabled",
    lastSyncAt: null,
    lastError: null,
    pending: 0,
    peers: [],
  })
}
