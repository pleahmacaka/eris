import {
  createClient,
  generateScope,
  isValidAuthMetadata,
  OAuth2,
  type OAuthRegistrationRequest,
  type ValidatedAuthMetadata,
} from "matrix-js-sdk"
import { loginWithToken } from "./client"
import type { OAuthGrant, StoredSession } from "./session"

export type IdentityProvider = { id: string; name: string }

export type AuthOptions = {
  oauth: ValidatedAuthMetadata | null
  sso: IdentityProvider[] | null
  password: boolean
  preferRedirect: boolean
}

export type RedirectTarget = {
  uri: string
  registeredUri: string
  applicationType: "web" | "native"
}

type PendingOAuth = {
  kind: "oauth"
  state: string
  homeserver: string
  redirectUri: string
  clientId: string
  deviceId: string
  codeVerifier: string
  metadata: ValidatedAuthMetadata
}

type PendingSso = {
  kind: "sso"
  state: string
  homeserver: string
}

type Pending = PendingOAuth | PendingSso

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

export const CLIENT_URI = "https://eris.arixlab.com"
export const CLIENTS_KEY = "eris.oauth.clients"
export const PENDING_KEY = "eris.auth.pending"
export const AUTH_CANCELLED = "ERIS_AUTH_CANCELLED"
export const AUTH_FAILED = "ERIS_AUTH_FAILED"
export const REFRESH_MARGIN_MS = 60_000

const STATE_PARAM = "eris_state"
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

export class AuthFlowError extends Error {
  readonly errcode: string

  constructor(errcode: string, message: string) {
    super(message)
    this.errcode = errcode
  }
}

export const randomString = (length: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length))

  return Array.from(bytes, byte => ID_ALPHABET[byte % ID_ALPHABET.length]).join(
    "",
  )
}

const getJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url, { headers: { Accept: "application/json" } })

  return response.ok ? response.json() : null
}

const tryJson = (url: string) => getJson(url).catch(() => null)

const issuerMetadata = async (homeserver: string) => {
  const body = await tryJson(
    `${homeserver}/_matrix/client/unstable/org.matrix.msc2965/auth_issuer`,
  )
  const issuer = (body as { issuer?: unknown } | null)?.issuer

  if (typeof issuer !== "string") {
    return null
  }

  const base = issuer.endsWith("/") ? issuer : `${issuer}/`

  return tryJson(new URL(".well-known/openid-configuration", base).href)
}

export const fetchAuthMetadata = async (
  homeserver: string,
): Promise<ValidatedAuthMetadata | null> => {
  const attempts = [
    () => tryJson(`${homeserver}/_matrix/client/v1/auth_metadata`),
    () =>
      tryJson(
        `${homeserver}/_matrix/client/unstable/org.matrix.msc2965/auth_metadata`,
      ),
    () => issuerMetadata(homeserver),
  ]

  for (const attempt of attempts) {
    const metadata = await attempt()

    if (isValidAuthMetadata(metadata)) {
      return metadata
    }
  }

  return null
}

type LoginFlow = {
  type?: unknown
  oauth_aware_preferred?: unknown
  identity_providers?: unknown
}

const parseProviders = (value: unknown): IdentityProvider[] =>
  Array.isArray(value)
    ? value.flatMap(entry =>
        typeof entry?.id === "string" && typeof entry?.name === "string"
          ? [{ id: entry.id, name: entry.name }]
          : [],
      )
    : []

export const probeAuth = async (homeserver: string): Promise<AuthOptions> => {
  const [oauth, body] = await Promise.all([
    fetchAuthMetadata(homeserver),
    getJson(`${homeserver}/_matrix/client/v3/login`),
  ])
  const flows: LoginFlow[] = Array.isArray(
    (body as { flows?: unknown } | null)?.flows,
  )
    ? (body as { flows: LoginFlow[] }).flows
    : []
  const sso = flows.find(flow => flow.type === "m.login.sso")

  return {
    oauth,
    sso: sso ? parseProviders(sso.identity_providers) : null,
    password: flows.some(flow => flow.type === "m.login.password"),
    preferRedirect: oauth !== null || sso?.oauth_aware_preferred === true,
  }
}

const clientMetadata = (target: RedirectTarget): OAuthRegistrationRequest => ({
  client_name: "Eris",
  client_uri: CLIENT_URI,
  application_type: target.applicationType,
  redirect_uris: [target.registeredUri],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
})

const readClients = (storage: KeyValueStorage): Record<string, string> => {
  try {
    const value: unknown = JSON.parse(storage.getItem(CLIENTS_KEY) ?? "{}")

    return typeof value === "object" && value !== null
      ? (value as Record<string, string>)
      : {}
  } catch {
    return {}
  }
}

export const registeredClientId = async (
  metadata: ValidatedAuthMetadata,
  target: RedirectTarget,
  storage: KeyValueStorage,
) => {
  const key = `${metadata.issuer} ${target.applicationType} ${target.registeredUri}`
  const clients = readClients(storage)
  const cached = clients[key]

  if (typeof cached === "string" && cached !== "") {
    return cached
  }

  const clientId = await OAuth2.registerClient(metadata, clientMetadata(target))

  storage.setItem(CLIENTS_KEY, JSON.stringify({ ...clients, [key]: clientId }))

  return clientId
}

const savePending = (storage: KeyValueStorage, pending: Pending) =>
  storage.setItem(PENDING_KEY, JSON.stringify(pending))

const takePending = (storage: KeyValueStorage): Pending | null => {
  const raw = storage.getItem(PENDING_KEY)

  storage.removeItem(PENDING_KEY)

  try {
    return raw ? (JSON.parse(raw) as Pending) : null
  } catch {
    return null
  }
}

export const hasPendingAuth = (storage: KeyValueStorage) =>
  storage.getItem(PENDING_KEY) !== null

export const clearPendingAuth = (storage: KeyValueStorage) =>
  storage.removeItem(PENDING_KEY)

export const beginOAuth = async (
  homeserver: string,
  metadata: ValidatedAuthMetadata,
  target: RedirectTarget,
  storage: { clients: KeyValueStorage; pending: KeyValueStorage },
) => {
  const clientId = await registeredClientId(metadata, target, storage.clients)
  const deviceId = randomString(10)
  const state = randomString(32)
  const oauth = new OAuth2(metadata, { clientId, deviceId })
  const url = await oauth.generateAuthorizationCodeGrantUrl(
    state,
    target.uri,
    "query",
    undefined,
    generateScope(deviceId),
  )

  savePending(storage.pending, {
    kind: "oauth",
    state,
    homeserver,
    redirectUri: target.uri,
    clientId,
    deviceId,
    codeVerifier: oauth.context.codeVerifier,
    metadata,
  })

  return url
}

export const beginSso = (
  homeserver: string,
  target: RedirectTarget,
  pending: KeyValueStorage,
  providerId?: string,
) => {
  const state = randomString(32)
  const redirect = new URL(target.uri)

  redirect.searchParams.set(STATE_PARAM, state)

  const path = providerId
    ? `/login/sso/redirect/${encodeURIComponent(providerId)}`
    : "/login/sso/redirect"
  const url = new URL(`${homeserver}/_matrix/client/v3${path}`)

  url.searchParams.set("redirectUrl", redirect.href)
  savePending(pending, { kind: "sso", state, homeserver })

  return url.href
}

export const isAuthCallback = (href: string) => {
  const params = new URL(href).searchParams

  return (
    params.has("loginToken") ||
    (params.has("state") && (params.has("code") || params.has("error")))
  )
}

const failed = (message: string) => new AuthFlowError(AUTH_FAILED, message)

const grantFromTokens = (
  pending: PendingOAuth,
  tokens: { refresh_token?: string; expires_in?: number },
  now: number,
): OAuthGrant => ({
  clientId: pending.clientId,
  issuer: pending.metadata.issuer,
  refreshToken: tokens.refresh_token ?? null,
  expiresAt:
    tokens.expires_in === undefined ? null : now + tokens.expires_in * 1000,
  accountUri: pending.metadata.account_management_uri ?? null,
})

const completeOAuth = async (
  pending: PendingOAuth,
  params: URLSearchParams,
): Promise<StoredSession> => {
  if (params.get("state") !== pending.state) {
    throw failed("state mismatch")
  }

  const error = params.get("error")

  if (error) {
    throw new AuthFlowError(
      error === "access_denied" ? AUTH_CANCELLED : AUTH_FAILED,
      error,
    )
  }

  const code = params.get("code")

  if (!code) {
    throw failed("missing code")
  }

  const oauth = new OAuth2(pending.metadata, {
    clientId: pending.clientId,
    deviceId: pending.deviceId,
    codeVerifier: pending.codeVerifier,
  })
  const tokens = await oauth.completeAuthorizationCodeGrant(
    code,
    pending.redirectUri,
  )
  const whoami = await createClient({
    baseUrl: pending.homeserver,
    accessToken: tokens.access_token,
  }).whoami()

  return {
    homeserver: pending.homeserver,
    userId: whoami.user_id,
    accessToken: tokens.access_token,
    deviceId: whoami.device_id ?? pending.deviceId,
    oauth: grantFromTokens(pending, tokens, Date.now()),
  }
}

export const completeAuth = async (
  href: string,
  pendingStorage: KeyValueStorage,
): Promise<StoredSession> => {
  const params = new URL(href).searchParams
  const pending = takePending(pendingStorage)

  if (!pending) {
    throw failed("no pending sign-in")
  }

  if (pending.kind === "oauth") {
    return completeOAuth(pending, params)
  }

  const token = params.get("loginToken")

  if (params.get(STATE_PARAM) !== pending.state || !token) {
    throw failed("invalid SSO callback")
  }

  return loginWithToken(pending.homeserver, token)
}

export const refreshExpiringSession = async (
  session: StoredSession,
  now = Date.now(),
): Promise<StoredSession> => {
  const grant = session.oauth

  if (
    !grant?.refreshToken ||
    grant.expiresAt === null ||
    grant.expiresAt - now > REFRESH_MARGIN_MS
  ) {
    return session
  }

  const metadata = await fetchAuthMetadata(session.homeserver)

  if (!metadata) {
    throw failed("auth metadata unavailable")
  }

  const tokens = await new OAuth2(metadata, {
    clientId: grant.clientId,
    deviceId: session.deviceId,
  }).performRefreshTokenGrant(grant.refreshToken)

  return {
    ...session,
    accessToken: tokens.access_token,
    oauth: {
      ...grant,
      refreshToken: tokens.refresh_token ?? grant.refreshToken,
      expiresAt:
        tokens.expires_in === undefined ? null : now + tokens.expires_in * 1000,
    },
  }
}
