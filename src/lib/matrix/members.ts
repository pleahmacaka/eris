import type { MessageKey } from "#lib/i18n/catalogs.js"
export type Presence = "online" | "offline" | "unavailable" | undefined

export type MemberDigest = {
  userId: string
  name: string
  avatarUrl: string | null
  powerLevel: number
  presence: Presence
}

export type MemberRole = "admin" | "moderator" | "member"

export const ROLE_LABEL: Record<MemberRole, MessageKey> = {
  admin: "members.role.admin",
  moderator: "members.role.moderator",
  member: "members.role.member",
}

const ROLE_ORDER: MemberRole[] = ["admin", "moderator", "member"]

export const roleFor = (powerLevel: number): MemberRole =>
  powerLevel >= 100 ? "admin" : powerLevel >= 50 ? "moderator" : "member"

export const isOnline = (presence: Presence) =>
  presence === "online" || presence === "unavailable"

export type MemberGroup = {
  role: MemberRole
  label: MessageKey
  members: MemberDigest[]
}

const byPresenceThenName = (a: MemberDigest, b: MemberDigest) =>
  Number(isOnline(b.presence)) - Number(isOnline(a.presence)) ||
  a.name.localeCompare(b.name, "ko")

export const groupMembers = (members: MemberDigest[]): MemberGroup[] =>
  ROLE_ORDER.map(role => ({
    role,
    label: ROLE_LABEL[role],
    members: members
      .filter(member => roleFor(member.powerLevel) === role)
      .sort(byPresenceThenName),
  })).filter(group => group.members.length > 0)
