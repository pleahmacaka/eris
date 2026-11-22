import {
  type MatrixClient,
  type Room,
  type User,
  UserEvent,
} from "matrix-js-sdk"
import { memberAvatarUrl } from "./digest"
import type { Presence } from "./members"
import { localpart } from "./rooms"

export type ProfileDigest = { displayName: string; avatarUrl: string | null }

export const fetchProfile = async (
  client: MatrixClient,
  userId: string,
): Promise<ProfileDigest> => {
  try {
    const profile = await client.getProfileInfo(userId)

    return {
      displayName: profile.displayname || localpart(userId),
      avatarUrl: profile.avatar_url || null,
    }
  } catch {
    return { displayName: localpart(userId), avatarUrl: null }
  }
}

export const knownPresence = (user: User | null | undefined): Presence =>
  user?.events.presence ? (user.presence as Presence) : undefined

export type UserDigest = {
  userId: string
  name: string
  avatarUrl: string | null
  presence: Presence
  powerLevel: number | null
}

export const describeUser = (
  client: MatrixClient,
  room: Room | null,
  userId: string,
): UserDigest => {
  const member = room?.getMember(userId) ?? null
  const user = client.getUser(userId)

  return {
    userId,
    name: member?.rawDisplayName || user?.rawDisplayName || localpart(userId),
    avatarUrl: memberAvatarUrl(member) ?? user?.avatarUrl ?? null,
    presence: knownPresence(user),
    powerLevel: member?.membership === "join" ? member.powerLevel : null,
  }
}

export const watchUser = (
  client: MatrixClient,
  userId: string,
  onPresence: (user: User) => void,
  onProfile: () => void,
) => {
  const presence = (_event: unknown, user: User) => {
    if (user.userId === userId) {
      onPresence(user)
    }
  }
  const profile = (_event: unknown, user: User) => {
    if (user.userId === userId) {
      onProfile()
    }
  }

  client.on(UserEvent.Presence, presence)
  client.on(UserEvent.DisplayName, profile)
  client.on(UserEvent.AvatarUrl, profile)

  return () => {
    client.off(UserEvent.Presence, presence)
    client.off(UserEvent.DisplayName, profile)
    client.off(UserEvent.AvatarUrl, profile)
  }
}
