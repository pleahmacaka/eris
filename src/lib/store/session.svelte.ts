import type { MatrixClient } from "matrix-js-sdk"
import type { Message } from "#lib/i18n/translate.js"
import {
  createSessionClient,
  endSession,
  loginWithPassword,
  startSyncing,
} from "#lib/matrix/client.js"
import { errorCode, loginError } from "#lib/matrix/errors.js"
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
import { callStore } from "#lib/store/call.svelte.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { groupCallStore } from "#lib/store/groupCall.svelte.js"
import { mediaStore } from "#lib/store/media.svelte.js"

export type SessionStatus =
  | "restoring"
  | "signed-out"
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

  async restore() {
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

    const client = createSessionClient(session)

    try {
      await startSyncing(client)
      await this.loadProfile(client, session.userId)
      this.attach(client, session.userId)
      this.client = client
      this.status = "ready"
    } catch (error) {
      client.stopClient()

      if (errorCode(error) === "M_UNKNOWN_TOKEN") {
        clearSession(localStorage)
        this.session = null
        this.status = "signed-out"
        this.error = { key: "session.expired" }
      } else {
        this.status = "failed"
        this.error = { key: "session.unreachable" }
      }
    }
  }
}

export const sessionStore = new SessionStore()
