import {
  ClientEvent,
  createClient,
  type MatrixClient,
  SyncState,
} from "matrix-js-sdk"
import { normalizeHomeserver, type StoredSession } from "./session"

export const DEVICE_NAME = "Eris"

export const loginWithPassword = async (
  homeserver: string,
  username: string,
  password: string,
): Promise<StoredSession> => {
  const client = createClient({ baseUrl: homeserver })
  const response = await client.loginRequest({
    type: "m.login.password",
    identifier: { type: "m.id.user", user: username },
    password,
    initial_device_display_name: DEVICE_NAME,
  })
  const advertised = response.well_known?.["m.homeserver"]?.base_url

  return {
    homeserver: advertised ? normalizeHomeserver(advertised) : homeserver,
    userId: response.user_id,
    accessToken: response.access_token,
    deviceId: response.device_id,
  }
}

export const createSessionClient = (session: StoredSession) =>
  createClient({
    baseUrl: session.homeserver,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
    useAuthorizationHeader: true,
    fallbackICEServerAllowed: true,
    timelineSupport: true,
  })

export const startSyncing = (client: MatrixClient) =>
  new Promise<void>((resolve, reject) => {
    const onSync = (
      state: SyncState,
      _previous: SyncState | null,
      data?: { error?: Error },
    ) => {
      if (state === SyncState.Prepared) {
        client.off(ClientEvent.Sync, onSync)
        resolve()
      } else if (state === SyncState.Error && !client.isInitialSyncComplete()) {
        client.off(ClientEvent.Sync, onSync)
        reject(data?.error ?? new Error("initial sync failed"))
      }
    }

    client.on(ClientEvent.Sync, onSync)
    client
      .startClient({ initialSyncLimit: 30, lazyLoadMembers: true })
      .catch(reject)
  })

export const endSession = async (client: MatrixClient) => {
  try {
    await client.logout(true)
  } finally {
    client.stopClient()
  }
}
