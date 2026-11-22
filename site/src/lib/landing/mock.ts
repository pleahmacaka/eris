export type MockPresence = "online" | "away" | "offline"

export type MockVoiceState = "idle" | "speaking" | "muted"

export type MockResultKind = "text" | "voice" | "dm" | "server"

export type MockTextChannel = "general" | "dev"

export type MockAttachmentKind = "file" | "audio"

export const MOCK_ROLE_IDS = ["admin", "moderator", "member"] as const

export type MockRoleId = (typeof MOCK_ROLE_IDS)[number]

export const MOCK_PERMISSION_IDS = [
  "send",
  "invite",
  "kick",
  "ban",
  "redact",
  "state",
  "call",
] as const

export type MockPermissionId = (typeof MOCK_PERMISSION_IDS)[number]
