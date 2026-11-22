import {
  type AccessTokens,
  HttpApiEvent,
  type MatrixClient,
  OAuth2HTTPError,
} from "matrix-js-sdk"
import type { Message } from "#lib/i18n/translate.js"
import {
  type AuthOptions,
  beginOAuth,
  beginSso,
  clearPendingAuth,
  completeAuth,
  fetchAuthMetadata,
  hasPendingAuth,
  isAuthCallback,
  refreshExpiringSession,
} from "#lib/matrix/auth.js"
import {
  createSessionClient,
  endSession,
  loginWithPassword,
  type OAuthBinding,
  startSyncing,
} from "#lib/matrix/client.js"
import { errorCode, loginError, redirectError } from "#lib/matrix/errors.js"
import { AVATAR_LARGE, AVATAR_THUMBNAIL } from "#lib/matrix/media.js"
import type { Presence } from "#lib/matrix/members.js"
import { fetchProfile, knownPresence, watchUser } from "#lib/matrix/profile.js"
import {
  clearSession,
  loadSession,
  normalizeHomeserver,
  type StoredSession,
  saveSession,
} from "#lib/matrix/session.js"
import {
  type AuthRedirect,
  type LoopbackPage,
  prepareAuthRedirect,
} from "#lib/shell/authRedirect.js"
import { callStore } from "#lib/store/call.svelte.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { groupCallStore } from "#lib/store/groupCall.svelte.js"
import { mediaStore } from "#lib/store/media.svelte.js"

export type SessionStatus =
  | "restoring"
  | "signed-out"
  | "authorizing"
  | "signing-in"
  | "connecting"
  | "ready"
  | "failed"

class SessionStore {
  status = $state<SessionStatus>("restoring")
  session = $state<StoredSession | null>(null)
  client = $state.raw<MatrixClient | null>(null)
  displayName = $state("")
  avatarUrl = $state<string | null>(null)
  presence = $state<Presence>(undefined)
  error = $state<Message | null>(null)

  private unwatchUser: (() => void) | null = null
  private redirect: AuthRedirect | null = null

  async restore() {
    const href = location.href

    if (hasPendingAuth(sessionStorage) && isAuthCallback(href)) {
      await this.finishRedirect(href)

      return
    }

    const stored = loadSession(localStorage)

    if (!stored) {
      this.status = "signed-out"

      return
    }

    await this.connect(stored)
  }

  async login(homeserver: string, username: string, password: string) {
    this.error = null
    this.status = "signing-in"

    try {
      const session = await loginWithPassword(
        normalizeHomeserver(homeserver),
        username.trim(),
        password,
      )

      saveSession(localStorage, session)
      await this.connect(session)
    } catch (error) {
      this.status = "signed-out"
      this.error = loginError(errorCode(error))
      console.error("login failed", error)
    }
  }

  async loginWithRedirect(
    homeserver: string,
    options: AuthOptions,
    page: LoopbackPage,
    providerId?: string,
  ) {
    this.cancelRedirect()
    this.error = null
    this.status = "authorizing"

    const base = normalizeHomeserver(homeserver)
    let redirect: AuthRedirect | null = null

    try {
      redirect = await prepareAuthRedirect(page)
      this.redirect = redirect

      const url = options.oauth
        ? await beginOAuth(base, options.oauth, redirect.target, {
            clients: localStorage,
            pending: sessionStorage,
          })
        : beginSso(base, redirect.target, sessionStorage, providerId)

      if (this.redirect !== redirect) {
        return
      }

      const callback = await redirect.open(url)

      if (this.redirect === redirect) {
        this.redirect = null
        await this.finishRedirect(callback)
      }
    } catch (error) {
      if (redirect === null || this.redirect === redirect) {
        this.redirect = null
        clearPendingAuth(sessionStorage)
        this.status = "signed-out"
        this.error = redirectError(errorCode(error))
        console.error("redirect sign-in failed", error)
      }
    } finally {
      redirect?.dispose()
    }
  }

  cancelRedirect() {
    const redirect = this.redirect

    if (!redirect) {
      return
    }

    this.redirect = null
    redirect.dispose()
    clearPendingAuth(sessionStorage)
    this.status = "signed-out"
  }

  async retry() {
    if (this.session) {
      await this.connect(this.session)
    }
  }

  async logout() {
    const client = this.client

    this.client = null
    this.session = null
    this.error = null
    this.status = "signed-out"
    clearSession(localStorage)

    if (client) {
      try {
        await this.detach()
      } finally {
        await endSession(client)
      }
    }
  }

  private async finishRedirect(href: string) {
    this.status = "signing-in"

    try {
      const session = await completeAuth(href, sessionStorage)

      saveSession(localStorage, session)
      await this.connect(session)
    } catch (error) {
      this.status = "signed-out"
      this.error = redirectError(errorCode(error))
      console.error("redirect sign-in failed", error)
    }
  }

  private persist(session: StoredSession) {
    this.session = session
    saveSession(localStorage, session)
  }

  private applyRefresh(tokens: AccessTokens) {
    const session = this.session

    if (!session?.oauth) {
      return
    }

    this.persist({
      ...session,
      accessToken: tokens.accessToken,
      oauth: {
        ...session.oauth,
        refreshToken: tokens.refreshToken ?? session.oauth.refreshToken,
        expiresAt: tokens.expiry?.getTime() ?? null,
      },
    })
  }

  private oauthBinding(session: StoredSession): OAuthBinding {
    return {
      onTokenRefresh: tokens => this.applyRefresh(tokens),
      authMetadata: async () => {
        const metadata = await fetchAuthMetadata(session.homeserver)

        if (!metadata) {
          throw new Error("auth metadata unavailable")
        }

        return metadata
      },
    }
  }

  private async expire() {
    const client = this.client

    this.client = null
    this.session = null
    clearSession(localStorage)
    this.status = "signed-out"
    this.error = { key: "session.expired" }

    if (client) {
      try {
        await this.detach()
      } finally {
        client.stopClient()
      }
    }
  }

  async changeDisplayName(name: string) {
    const client = this.client

    if (!client) {
      return
    }

    await client.setDisplayName(name)
    this.displayName = name
  }

  async changeAvatar(file: File) {
    const client = this.client

    if (!client) {
      return
    }

    const url = await mediaStore.upload(file)

    await client.setAvatarUrl(url)
    await Promise.all([
      mediaStore.loadThumbnail(url, AVATAR_THUMBNAIL),
      mediaStore.loadThumbnail(url, AVATAR_LARGE),
    ])
    this.avatarUrl = url
  }

  async removeAvatar() {
    const client = this.client

    if (!client) {
      return
    }

    await client.setAvatarUrl("")
    this.avatarUrl = null
  }

  private async loadProfile(client: MatrixClient, userId: string) {
    const profile = await fetchProfile(client, userId)

    this.displayName = profile.displayName
    this.avatarUrl = profile.avatarUrl
  }

  private attach(client: MatrixClient, userId: string) {
    mediaStore.attach(client)
    chatStore.attach(client)
    callStore.watch(client, roomId => client.getRoom(roomId)?.name ?? roomId)
    void groupCallStore.probeSupport(client)
    this.presence = knownPresence(client.getUser(userId))
    this.unwatchUser = watchUser(
      client,
      userId,
      user => {
        this.presence = knownPresence(user)
      },
      () => void this.loadProfile(client, userId),
    )
  }

  private async detach() {
    this.unwatchUser?.()
    this.unwatchUser = null
    this.avatarUrl = null
    this.presence = undefined
    callStore.stopWatching()
    chatStore.detach()
    mediaStore.detach()
    groupCallStore.clearSupport()
    await groupCallStore.leave()
  }

  private async connect(session: StoredSession) {
    this.session = session
    this.status = "connecting"
    this.error = null

    let current = session

    try {
      current = await refreshExpiringSession(session)
    } catch (error) {
      if (error instanceof OAuth2HTTPError) {
        await this.expire()

        return
      }

      console.warn("token refresh deferred", error)
    }

    if (current !== session) {
      this.persist(current)
    }

    const client = createSessionClient(
      current,
      current.oauth ? this.oauthBinding(current) : undefined,
    )

    try {
      await startSyncing(client)
      await this.loadProfile(client, current.userId)
      this.attach(client, current.userId)
      client.once(HttpApiEvent.SessionLoggedOut, () => {
        if (this.client === client) {
          void this.expire()
        }
      })
      this.client = client
      this.status = "ready"
    } catch (error) {
      client.stopClient()

      const code = errorCode(error)

      if (code === "M_UNKNOWN_TOKEN" || code === "TokenRefreshLogoutError") {
        await this.expire()
      } else {
        this.status = "failed"
        this.error = { key: "session.unreachable" }
      }
    }
  }
}

export const sessionStore = new SessionStore()
