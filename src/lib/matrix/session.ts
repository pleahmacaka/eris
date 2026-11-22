export type OAuthGrant = {
  clientId: string
  issuer: string
  refreshToken: string | null
  expiresAt: number | null
  accountUri: string | null
}

export type StoredSession = {
  homeserver: string
  userId: string
  accessToken: string
  deviceId: string
  oauth?: OAuthGrant
}

export const SESSION_KEY = "eris.session"

export const DEFAULT_HOMESERVER = "matrix.org"

type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const SESSION_FIELDS = [
  "homeserver",
  "userId",
  "accessToken",
  "deviceId",
] as const

export const normalizeHomeserver = (input: string) => {
  let value = input.trim()

  while (value.endsWith("/")) {
    value = value.slice(0, -1)
  }

  if (value === "") {
    return ""
  }

  const lower = value.toLowerCase()

  return lower.startsWith("http://") || lower.startsWith("https://")
    ? value
    : `https://${value}`
}

export const isUserId = (value: string) => {
  const trimmed = value.trim()
  const colon = trimmed.indexOf(":")

  return trimmed.startsWith("@") && colon > 1 && colon < trimmed.length - 1
}

export const parseUserIds = (input: string) => {
  const ids = [
    ...new Set(
      input
        .split(/[\s,]+/)
        .map(part => part.trim())
        .filter(part => part !== ""),
    ),
  ]

  return ids.length > 0 && ids.every(isUserId) ? ids : null
}

export const splitUserId = (input: string) => {
  const trimmed = input.trim()
  const bare = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed
  const colon = bare.indexOf(":")

  if (colon === -1) {
    return { localpart: bare, domain: null }
  }

  const domain = bare.slice(colon + 1)

  return {
    localpart: bare.slice(0, colon),
    domain: domain === "" ? null : domain,
  }
}

const optionalString = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : null

const parseGrant = (value: unknown): OAuthGrant | null => {
  if (typeof value !== "object" || value === null) {
    return null
  }

  const record = value as Record<string, unknown>
  const clientId = optionalString(record.clientId)
  const issuer = optionalString(record.issuer)

  if (!clientId || !issuer) {
    return null
  }

  return {
    clientId,
    issuer,
    refreshToken: optionalString(record.refreshToken),
    expiresAt: typeof record.expiresAt === "number" ? record.expiresAt : null,
    accountUri: optionalString(record.accountUri),
  }
}

export const parseSession = (raw: string | null): StoredSession | null => {
  if (!raw) {
    return null
  }

  let value: unknown

  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof value !== "object" || value === null) {
    return null
  }

  const record = value as Record<string, unknown>
  const complete = SESSION_FIELDS.every(
    field => typeof record[field] === "string" && record[field] !== "",
  )

  if (!complete) {
    return null
  }

  const session: StoredSession = {
    homeserver: normalizeHomeserver(record.homeserver as string),
    userId: record.userId as string,
    accessToken: record.accessToken as string,
    deviceId: record.deviceId as string,
  }

  if (record.oauth === undefined) {
    return session
  }

  const oauth = parseGrant(record.oauth)

  return oauth ? { ...session, oauth } : null
}

export const loadSession = (storage: SessionStorage) =>
  parseSession(storage.getItem(SESSION_KEY))

export const saveSession = (storage: SessionStorage, session: StoredSession) =>
  storage.setItem(SESSION_KEY, JSON.stringify(session))

export const clearSession = (storage: SessionStorage) =>
  storage.removeItem(SESSION_KEY)
