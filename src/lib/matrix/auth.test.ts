import { afterEach, describe, expect, test } from "bun:test"
import { loopbackTarget, webTarget } from "#lib/shell/authRedirect.js"
import {
  AUTH_CANCELLED,
  AUTH_FAILED,
  beginOAuth,
  beginSso,
  CLIENT_URI,
  completeAuth,
  fetchAuthMetadata,
  hasPendingAuth,
  isAuthCallback,
  probeAuth,
  REFRESH_MARGIN_MS,
  refreshExpiringSession,
  registeredClientId,
} from "./auth"
import type { StoredSession } from "./session"

const HOMESERVER = "https://hs.example"
const ISSUER = "https://auth.example/"

const metadata = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}authorize`,
  token_endpoint: `${ISSUER}oauth2/token`,
  registration_endpoint: `${ISSUER}oauth2/registration`,
  revocation_endpoint: `${ISSUER}oauth2/revoke`,
  account_management_uri: `${ISSUER}account/`,
  response_types_supported: ["code"],
  response_modes_supported: ["query", "fragment"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
}

type Call = { method: string; url: string; body: string }
type Route = (call: Call) => Response | undefined

const realFetch = globalThis.fetch
let calls: Call[] = []

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const mockFetch = (route: Route) => {
  calls = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = {
      method: init?.method ?? "GET",
      url: input instanceof Request ? input.url : String(input),
      body:
        typeof init?.body === "string" ? init.body : String(init?.body ?? ""),
    }

    calls.push(call)

    return route(call) ?? json({ errcode: "M_UNRECOGNIZED" }, 404)
  }) as typeof fetch
}

const memoryStorage = () => {
  const map = new Map<string, string>()

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
  }
}

const challengeOf = async (verifier: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  )

  return Buffer.from(digest).toString("base64url")
}

afterEach(() => {
  globalThis.fetch = realFetch
})

describe("fetchAuthMetadata", () => {
  test("uses the stable endpoint", async () => {
    mockFetch(({ url }) =>
      url === `${HOMESERVER}/_matrix/client/v1/auth_metadata`
        ? json(metadata)
        : undefined,
    )

    expect(await fetchAuthMetadata(HOMESERVER)).toEqual(metadata)
  })

  test("falls back to the unstable auth_issuer discovery", async () => {
    mockFetch(({ url }) => {
      if (url.endsWith("/org.matrix.msc2965/auth_issuer")) {
        return json({ issuer: ISSUER })
      }

      return url === `${ISSUER}.well-known/openid-configuration`
        ? json(metadata)
        : undefined
    })

    expect(await fetchAuthMetadata(HOMESERVER)).toEqual(metadata)
    expect(calls.map(call => call.url)).toEqual([
      `${HOMESERVER}/_matrix/client/v1/auth_metadata`,
      `${HOMESERVER}/_matrix/client/unstable/org.matrix.msc2965/auth_metadata`,
      `${HOMESERVER}/_matrix/client/unstable/org.matrix.msc2965/auth_issuer`,
      `${ISSUER}.well-known/openid-configuration`,
    ])
  })

  test("returns null without valid metadata", async () => {
    mockFetch(({ url }) =>
      url.endsWith("/v1/auth_metadata") ? json({ issuer: ISSUER }) : undefined,
    )

    expect(await fetchAuthMetadata(HOMESERVER)).toBeNull()
  })
})

describe("probeAuth", () => {
  test("prefers OAuth when the server advertises metadata", async () => {
    mockFetch(({ url }) => {
      if (url.endsWith("/v1/auth_metadata")) {
        return json(metadata)
      }

      return url.endsWith("/v3/login")
        ? json({
            flows: [
              { type: "m.login.password" },
              { type: "m.login.sso", oauth_aware_preferred: true },
            ],
          })
        : undefined
    })

    const options = await probeAuth(HOMESERVER)

    expect(options.oauth?.issuer).toBe(ISSUER)
    expect(options.password).toBe(true)
    expect(options.preferRedirect).toBe(true)
  })

  test("lists legacy SSO identity providers", async () => {
    mockFetch(({ url }) =>
      url.endsWith("/v3/login")
        ? json({
            flows: [
              { type: "m.login.password" },
              {
                type: "m.login.sso",
                identity_providers: [
                  { id: "oidc-github", name: "GitHub" },
                  { id: 3 },
                ],
              },
            ],
          })
        : undefined,
    )

    expect(await probeAuth(HOMESERVER)).toEqual({
      oauth: null,
      sso: [{ id: "oidc-github", name: "GitHub" }],
      password: true,
      preferRedirect: false,
    })
  })
})

describe("client registration", () => {
  test("registers once per issuer and redirect URI", async () => {
    mockFetch(({ url }) =>
      url === metadata.registration_endpoint
        ? json({ client_id: "CLIENT" }, 201)
        : undefined,
    )

    const storage = memoryStorage()
    const target = loopbackTarget(54321)

    expect(await registeredClientId(metadata, target, storage)).toBe("CLIENT")
    expect(await registeredClientId(metadata, target, storage)).toBe("CLIENT")
    expect(calls).toHaveLength(1)
    expect(JSON.parse(calls[0]?.body ?? "")).toMatchObject({
      client_name: "Eris",
      client_uri: CLIENT_URI,
      application_type: "native",
      redirect_uris: ["http://127.0.0.1/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    })
  })

  test("picks the application type from the web origin", () => {
    expect(webTarget("https://eris.arixlab.com").applicationType).toBe("web")
    expect(webTarget("http://localhost:1420")).toEqual({
      uri: "http://localhost:1420/login/callback",
      registeredUri: "http://localhost:1420/login/callback",
      applicationType: "native",
    })
  })
})

const startLoopbackFlow = async () => {
  const storage = { clients: memoryStorage(), pending: memoryStorage() }
  const url = new URL(
    await beginOAuth(HOMESERVER, metadata, loopbackTarget(54321), storage),
  )
  const pending = JSON.parse(storage.pending.getItem("eris.auth.pending") ?? "")

  return { storage, url, pending }
}

describe("OAuth authorization code flow", () => {
  test("builds a PKCE authorization URL for the loopback redirect", async () => {
    mockFetch(({ url }) =>
      url === metadata.registration_endpoint
        ? json({ client_id: "CLIENT" }, 201)
        : undefined,
    )

    const { url, pending } = await startLoopbackFlow()
    const params = url.searchParams

    expect(url.origin + url.pathname).toBe(metadata.authorization_endpoint)
    expect(params.get("client_id")).toBe("CLIENT")
    expect(params.get("redirect_uri")).toBe("http://127.0.0.1:54321/callback")
    expect(params.get("response_type")).toBe("code")
    expect(params.get("response_mode")).toBe("query")
    expect(params.get("code_challenge_method")).toBe("S256")
    expect(params.get("code_challenge")).toBe(
      await challengeOf(pending.codeVerifier),
    )
    expect(params.get("state")).toBe(pending.state)
    expect(params.get("scope")).toBe(
      `urn:matrix:client:api:* urn:matrix:client:device:${pending.deviceId}`,
    )
  })

  test("exchanges the code for tokens and resolves the user", async () => {
    mockFetch(({ url, method }) => {
      if (url === metadata.registration_endpoint) {
        return json({ client_id: "CLIENT" }, 201)
      }

      if (url === metadata.token_endpoint && method === "POST") {
        return json({
          token_type: "bearer",
          access_token: "ACCESS",
          refresh_token: "REFRESH",
          expires_in: 300,
        })
      }

      return url.endsWith("/v3/account/whoami")
        ? json({ user_id: "@eris:hs.example", device_id: "DEVICE" })
        : undefined
    })

    const { storage, pending } = await startLoopbackFlow()
    const before = Date.now()
    const session = await completeAuth(
      `http://127.0.0.1:54321/callback?code=CODE&state=${pending.state}`,
      storage.pending,
    )
    const exchange = new URLSearchParams(
      calls.find(call => call.url === metadata.token_endpoint)?.body,
    )

    expect(exchange.get("grant_type")).toBe("authorization_code")
    expect(exchange.get("code")).toBe("CODE")
    expect(exchange.get("code_verifier")).toBe(pending.codeVerifier)
    expect(exchange.get("redirect_uri")).toBe("http://127.0.0.1:54321/callback")
    expect(session).toMatchObject({
      homeserver: HOMESERVER,
      userId: "@eris:hs.example",
      accessToken: "ACCESS",
      deviceId: "DEVICE",
      oauth: {
        clientId: "CLIENT",
        issuer: ISSUER,
        refreshToken: "REFRESH",
        accountUri: metadata.account_management_uri,
      },
    })
    expect(session.oauth?.expiresAt).toBeGreaterThanOrEqual(before + 300_000)
    expect(hasPendingAuth(storage.pending)).toBe(false)
  })

  test("rejects a mismatched state and reports a denied consent", async () => {
    mockFetch(({ url }) =>
      url === metadata.registration_endpoint
        ? json({ client_id: "CLIENT" }, 201)
        : undefined,
    )

    const first = await startLoopbackFlow()

    await expect(
      completeAuth(
        "http://127.0.0.1:54321/callback?code=CODE&state=forged",
        first.storage.pending,
      ),
    ).rejects.toMatchObject({ errcode: AUTH_FAILED })

    const second = await startLoopbackFlow()

    await expect(
      completeAuth(
        `http://127.0.0.1:54321/callback?error=access_denied&state=${second.pending.state}`,
        second.storage.pending,
      ),
    ).rejects.toMatchObject({ errcode: AUTH_CANCELLED })
  })
})

describe("legacy SSO", () => {
  test("redirects through the provider and logs in with the token", async () => {
    mockFetch(({ url, method }) =>
      url.endsWith("/v3/login") && method === "POST"
        ? json({
            user_id: "@eris:hs.example",
            access_token: "ACCESS",
            device_id: "DEVICE",
          })
        : undefined,
    )

    const pending = memoryStorage()
    const url = new URL(
      beginSso(
        HOMESERVER,
        webTarget("https://eris.arixlab.com"),
        pending,
        "oidc-github",
      ),
    )
    const redirect = new URL(url.searchParams.get("redirectUrl") ?? "")
    const callback = `${redirect.href}&loginToken=TOKEN`

    expect(url.pathname).toBe(
      "/_matrix/client/v3/login/sso/redirect/oidc-github",
    )
    expect(redirect.origin + redirect.pathname).toBe(
      "https://eris.arixlab.com/login/callback",
    )
    expect(isAuthCallback(callback)).toBe(true)

    const session = await completeAuth(callback, pending)
    const login = JSON.parse(calls.at(-1)?.body ?? "")

    expect(login).toMatchObject({ type: "m.login.token", token: "TOKEN" })
    expect(session).toMatchObject({
      userId: "@eris:hs.example",
      accessToken: "ACCESS",
    })
    expect(session.oauth).toBeUndefined()
  })
})

describe("refreshExpiringSession", () => {
  const session: StoredSession = {
    homeserver: HOMESERVER,
    userId: "@eris:hs.example",
    accessToken: "OLD",
    deviceId: "DEVICE",
    oauth: {
      clientId: "CLIENT",
      issuer: ISSUER,
      refreshToken: "REFRESH",
      expiresAt: 1_000_000,
      accountUri: null,
    },
  }

  test("keeps a token that is still fresh", async () => {
    mockFetch(() => undefined)

    const now = 1_000_000 - REFRESH_MARGIN_MS - 1

    expect(await refreshExpiringSession(session, now)).toBe(session)
    expect(calls).toHaveLength(0)
  })

  test("rotates the refresh token before expiry", async () => {
    mockFetch(({ url, method }) => {
      if (url.endsWith("/v1/auth_metadata")) {
        return json(metadata)
      }

      return url === metadata.token_endpoint && method === "POST"
        ? json({
            token_type: "Bearer",
            access_token: "NEW",
            refresh_token: "ROTATED",
            expires_in: 300,
          })
        : undefined
    })

    const now = 1_000_000 - 1_000
    const refreshed = await refreshExpiringSession(session, now)
    const grant = new URLSearchParams(calls.at(-1)?.body)

    expect(grant.get("grant_type")).toBe("refresh_token")
    expect(grant.get("refresh_token")).toBe("REFRESH")
    expect(refreshed.accessToken).toBe("NEW")
    expect(refreshed.oauth).toMatchObject({
      refreshToken: "ROTATED",
      expiresAt: now + 300_000,
    })
  })
})
