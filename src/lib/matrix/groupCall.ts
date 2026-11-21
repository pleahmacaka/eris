import type { ConnectionState } from "livekit-client"
import type { MessageKey } from "#lib/i18n/catalogs.js"

export type RtcTransport = { type: string; [key: string]: unknown }

export type LivekitTransport = { type: "livekit"; livekit_service_url: string }

export const isLivekitTransport = (value: unknown): value is LivekitTransport =>
  typeof value === "object" &&
  value !== null &&
  (value as Record<string, unknown>).type === "livekit" &&
  typeof (value as Record<string, unknown>).livekit_service_url === "string"

const trimSlashes = (url: string) => {
  let value = url

  while (value.endsWith("/")) {
    value = value.slice(0, -1)
  }

  return value
}

export const livekitServiceUrlFromTransports = (transports: unknown) => {
  if (!Array.isArray(transports)) {
    return null
  }

  const livekit = transports.find(isLivekitTransport)

  return livekit ? trimSlashes(livekit.livekit_service_url) : null
}

export const livekitServiceUrlFromWellKnown = (wellKnown: unknown) =>
  typeof wellKnown === "object" && wellKnown !== null
    ? livekitServiceUrlFromTransports(
        (wellKnown as Record<string, unknown>)["org.matrix.msc4143.rtc_foci"],
      )
    : null

export const pickLivekitServiceUrl = (
  transports: unknown,
  wellKnown: unknown,
) =>
  livekitServiceUrlFromTransports(transports) ??
  livekitServiceUrlFromWellKnown(wellKnown)

export type MembershipDigest = {
  userId: string
  deviceId: string
  memberId: string
  createdTs: number
  transport: RtcTransport | undefined
}

export const participantIdentity = (userId: string, deviceId: string) =>
  `${userId}:${deviceId}`

export const splitIdentity = (identity: string) => {
  const colon = identity.lastIndexOf(":")

  return colon === -1
    ? { userId: identity, deviceId: "" }
    : { userId: identity.slice(0, colon), deviceId: identity.slice(colon + 1) }
}

const byCreation = (a: MembershipDigest, b: MembershipDigest) =>
  a.createdTs - b.createdTs

export const oldestTransport = (
  memberships: MembershipDigest[],
): LivekitTransport | undefined =>
  [...memberships]
    .sort(byCreation)
    .map(membership => membership.transport)
    .find(isLivekitTransport)

export type LivekitParticipantDigest = {
  identity: string
  speaking: boolean
  micEnabled: boolean
}

export type ParticipantProfile = { name: string; avatarUrl: string | null }

export type GroupParticipant = ParticipantProfile & {
  key: string
  userId: string
  deviceId: string
  me: boolean
  connected: boolean
  speaking: boolean
  muted: boolean
}

export const mergeParticipants = (
  memberships: MembershipDigest[],
  participants: LivekitParticipantDigest[],
  me: { userId: string; deviceId: string },
  profileOf: (userId: string) => ParticipantProfile,
): GroupParticipant[] => {
  const byIdentity = new Map(participants.map(p => [p.identity, p]))
  const seen = new Set<string>()
  const result: GroupParticipant[] = []

  for (const membership of [...memberships].sort(byCreation)) {
    const identity = participantIdentity(membership.userId, membership.deviceId)
    const live = byIdentity.get(membership.memberId) ?? byIdentity.get(identity)

    seen.add(membership.memberId)
    seen.add(identity)
    result.push({
      key: membership.memberId,
      userId: membership.userId,
      deviceId: membership.deviceId,
      ...profileOf(membership.userId),
      me:
        membership.userId === me.userId && membership.deviceId === me.deviceId,
      connected: live !== undefined,
      speaking: live?.speaking ?? false,
      muted: live ? !live.micEnabled : false,
    })
  }

  for (const participant of participants) {
    if (seen.has(participant.identity)) {
      continue
    }

    const { userId, deviceId } = splitIdentity(participant.identity)

    result.push({
      key: participant.identity,
      userId,
      deviceId,
      ...profileOf(userId),
      me: userId === me.userId && deviceId === me.deviceId,
      connected: true,
      speaking: participant.speaking,
      muted: !participant.micEnabled,
    })
  }

  return result
}

export type GroupCallPhase =
  | "idle"
  | "joining"
  | "connected"
  | "reconnecting"
  | "leaving"

export const GROUP_CALL_LABEL: Record<GroupCallPhase, MessageKey> = {
  idle: "voice.phase.idle",
  joining: "voice.phase.joining",
  connected: "voice.phase.connected",
  reconnecting: "voice.phase.reconnecting",
  leaving: "voice.phase.leaving",
}

export const phaseFromConnection = (
  state: `${ConnectionState}`,
): GroupCallPhase => {
  switch (state) {
    case "connected":
      return "connected"
    case "connecting":
      return "joining"
    case "reconnecting":
    case "signalReconnecting":
      return "reconnecting"
    default:
      return "idle"
  }
}
