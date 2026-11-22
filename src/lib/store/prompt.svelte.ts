import type { Message } from "#lib/i18n/translate.js"
import type { RoomKind } from "#lib/menu/menus.js"

export type ConfirmRequest = {
  title: Message
  body: Message
  action: Message
  note?: Message
  run: (note: string) => Promise<void>
}

export type RoomTarget = { roomId: string; name: string }

export type RoleTarget = RoomTarget & { userId: string; userName: string }

export type SettingsTarget = RoomTarget & { kind: RoomKind }

class PromptStore {
  confirming = $state.raw<ConfirmRequest | null>(null)
  inviting = $state.raw<RoomTarget | null>(null)
  assigning = $state.raw<RoleTarget | null>(null)
  configuring = $state.raw<SettingsTarget | null>(null)
}

export const promptStore = new PromptStore()
