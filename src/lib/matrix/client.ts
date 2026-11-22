import {
  type AccessTokens,
  ClientEvent,
  createClient,
  type LoginRequest,
  type MatrixClient,
  SyncState,
  type ValidatedAuthMetadata,
} from "matrix-js-sdk"
import { normalizeHomeserver, type StoredSession } from "./session"

export const DEVICE_NAME = "Eris"

const login = async (
  homeserver: string,
  request: LoginRequest,
): Promise<StoredSession> => {
  const client = createClient({ baseUrl: homeserver })
  const response = await client.loginRequest({
    ...request,
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

export const loginWithPassword = (
  homeserver: string,
  username: string,
  password: string,
) =>
  login(homeserver, {
    type: "m.login.password",
    identifier: { type: "m.id.user", user: username },
    password,
  })

export const loginWithToken = (homeserver: string, token: string) =>
  login(homeserver, { type: "m.login.token", token })

export type OAuthBinding = {
  onTokenRefresh: (tokens: AccessTokens) => void
  authMetadata: () => Promise<ValidatedAuthMetadata>
}

export const createSessionClient = (
  session: StoredSession,
  binding?: OAuthBinding,
) => {
  const oauth = binding ? session.oauth : undefined
  const client = createClient({
    baseUrl: session.homeserver,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
    refreshToken: oauth?.refreshToken ?? undefined,
    oauthClientId: oauth?.clientId,
    onTokenRefresh: binding?.onTokenRefresh,
    useAuthorizationHeader: true,
    fallbackICEServerAllowed: true,
    timelineSupport: true,
  })

  if (oauth && binding) {
    client.http.opts.authMetadataCallback = binding.authMetadata
  }

  return client
}

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
