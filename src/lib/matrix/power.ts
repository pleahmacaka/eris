import type { MessageKey } from "#lib/i18n/catalogs.js"
import type { Message } from "#lib/i18n/translate.js"
import { type MemberRole, ROLE_LABEL } from "./members"

export const POWER_LEVELS_EVENT = "m.room.power_levels"

export const ROOM_NAME_EVENT = "m.room.name"

export const CALL_MEMBER_EVENT = "org.matrix.msc3401.call.member"

export type PowerContent = Record<string, unknown>

const DEFAULT_LEVEL = {
  users_default: 0,
  events_default: 0,
  state_default: 50,
  invite: 0,
  kick: 50,
  ban: 50,
  redact: 50,
} as const

export type LevelField = keyof typeof DEFAULT_LEVEL

const finite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {}

export const fieldLevel = (content: PowerContent, field: LevelField) =>
  finite(content[field]) ?? DEFAULT_LEVEL[field]

export const stateEventLevel = (content: PowerContent, type: string) =>
  finite(record(content.events)[type]) ?? fieldLevel(content, "state_default")

export const userLevel = (content: PowerContent, userId: string) =>
  finite(record(content.users)[userId]) ?? fieldLevel(content, "users_default")

export type LevelKind = MemberRole | "owner" | "custom"

export const ROLE_LEVEL: Record<MemberRole, number> = {
  admin: 100,
  moderator: 50,
  member: 0,
}

export const ROLE_PRESETS: MemberRole[] = ["admin", "moderator", "member"]

export const levelKind = (level: number): LevelKind =>
  level === Infinity
    ? "owner"
    : (ROLE_PRESETS.find(role => ROLE_LEVEL[role] === level) ?? "custom")

export const levelLabel = (level: number): Message => {
  const kind = levelKind(level)

  if (kind === "owner") {
    return { key: "power.role.owner" }
  }

  return kind === "custom"
    ? { key: "power.role.custom", values: { level } }
    : { key: ROLE_LABEL[kind] }
}

export type Standing = { actor: number; target: number; self: boolean }

export const canEditLevels = (content: PowerContent, actor: number) =>
  actor >= stateEventLevel(content, POWER_LEVELS_EVENT)

export const canChangeLevel = (
  content: PowerContent,
  { actor, target, self }: Standing,
) =>
  canEditLevels(content, actor) &&
  target !== Infinity &&
  (self || target < actor)

export const canAssignLevel = (
  content: PowerContent,
  standing: Standing,
  level: number,
) =>
  canChangeLevel(content, standing) &&
  Number.isSafeInteger(level) &&
  level <= standing.actor

export const isSelfDemotion = ({ target, self }: Standing, level: number) =>
  self && level < target

export const canModerate = (
  content: PowerContent,
  action: "kick" | "ban",
  { actor, target, self }: Standing,
) => !self && target < actor && actor >= fieldLevel(content, action)

export const canUnban = (content: PowerContent, actor: number) =>
  actor >= Math.max(fieldLevel(content, "ban"), fieldLevel(content, "kick"))

export const canRedact = (content: PowerContent, actor: number) =>
  actor >= fieldLevel(content, "redact")

export const canManage = (content: PowerContent, actor: number) =>
  actor >=
  Math.min(
    stateEventLevel(content, POWER_LEVELS_EVENT),
    stateEventLevel(content, ROOM_NAME_EVENT),
    fieldLevel(content, "kick"),
    fieldLevel(content, "ban"),
  )

export type Permission = { key: string; label: MessageKey } & (
  | { field: LevelField }
  | { event: string }
)

export const PERMISSIONS: Permission[] = [
  { key: "send", label: "power.permission.send", field: "events_default" },
  { key: "invite", label: "power.permission.invite", field: "invite" },
  { key: "kick", label: "power.permission.kick", field: "kick" },
  { key: "ban", label: "power.permission.ban", field: "ban" },
  { key: "redact", label: "power.permission.redact", field: "redact" },
  { key: "state", label: "power.permission.state", field: "state_default" },
  { key: "call", label: "power.permission.call", event: CALL_MEMBER_EVENT },
]

export const permissionLevel = (
  content: PowerContent,
  permission: Permission,
) =>
  "field" in permission
    ? fieldLevel(content, permission.field)
    : stateEventLevel(content, permission.event)

export const withPermissionLevel = (
  content: PowerContent,
  permission: Permission,
  level: number,
): PowerContent =>
  "field" in permission
    ? { ...content, [permission.field]: level }
    : {
        ...content,
        events: { ...record(content.events), [permission.event]: level },
      }

export const canSetPermission = (
  content: PowerContent,
  permission: Permission,
  actor: number,
  level: number,
) =>
  canEditLevels(content, actor) &&
  permissionLevel(content, permission) <= actor &&
  level <= actor

export const permissionChoices = (current: number) => {
  const presets = ROLE_PRESETS.map(role => ROLE_LEVEL[role])

  return presets.includes(current)
    ? presets
    : [...presets, current].sort((a, b) => b - a)
}

export type PermissionLevels = Record<string, number>

export const readPermissionLevels = (content: PowerContent): PermissionLevels =>
  Object.fromEntries(
    PERMISSIONS.map(permission => [
      permission.key,
      permissionLevel(content, permission),
    ]),
  )

export const applyPermissionLevels = (
  content: PowerContent,
  levels: PermissionLevels,
  actor: number,
): PowerContent =>
  PERMISSIONS.reduce((next, permission) => {
    const level = levels[permission.key]

    return level !== undefined &&
      level !== permissionLevel(content, permission) &&
      canSetPermission(content, permission, actor, level)
      ? withPermissionLevel(next, permission, level)
      : next
  }, content)
