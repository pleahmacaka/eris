import type { MessageKey } from "#lib/i18n/catalogs.js"
import type { Binding } from "./binding"

type ActionSpec = {
  id: string
  label: MessageKey
  key: Binding
  typing?: true
  global?: true
  repeat?: true
}

type GroupSpec = { label: MessageKey; actions: readonly ActionSpec[] }

const GROUPS = [
  {
    label: "keymap.group.navigation",
    actions: [
      {
        id: "quickSwitch",
        label: "keymap.action.quickSwitch",
        key: "Mod+K",
        typing: true,
        global: true,
      },
      {
        id: "previousChannel",
        label: "keymap.action.previousChannel",
        key: "Alt+ArrowUp",
        typing: true,
      },
      {
        id: "nextChannel",
        label: "keymap.action.nextChannel",
        key: "Alt+ArrowDown",
        typing: true,
      },
      {
        id: "previousUnread",
        label: "keymap.action.previousUnread",
        key: "Alt+Shift+ArrowUp",
        typing: true,
      },
      {
        id: "nextUnread",
        label: "keymap.action.nextUnread",
        key: "Alt+Shift+ArrowDown",
        typing: true,
      },
      {
        id: "previousSpace",
        label: "keymap.action.previousSpace",
        key: "Mod+Alt+ArrowUp",
        typing: true,
      },
      {
        id: "nextSpace",
        label: "keymap.action.nextSpace",
        key: "Mod+Alt+ArrowDown",
        typing: true,
      },
      {
        id: "openFriends",
        label: "keymap.action.openFriends",
        key: "Mod+I",
        typing: true,
      },
      {
        id: "focusSearch",
        label: "keymap.action.focusSearch",
        key: "Mod+F",
        typing: true,
      },
    ],
  },
  {
    label: "keymap.group.conversation",
    actions: [
      {
        id: "startDm",
        label: "keymap.action.startDm",
        key: "Mod+Shift+A",
        typing: true,
      },
      { id: "focusMessage", label: "keymap.action.focusMessage", key: "/" },
      {
        id: "markChannelRead",
        label: "keymap.action.markChannelRead",
        key: "Escape",
        typing: true,
      },
      {
        id: "markSpaceRead",
        label: "keymap.action.markSpaceRead",
        key: "Shift+Escape",
        typing: true,
      },
      {
        id: "toggleMembers",
        label: "keymap.action.toggleMembers",
        key: "Mod+Shift+U",
        typing: true,
      },
      {
        id: "scrollUp",
        label: "keymap.action.scrollUp",
        key: "PageUp",
        typing: true,
        repeat: true,
      },
      {
        id: "scrollDown",
        label: "keymap.action.scrollDown",
        key: "PageDown",
        typing: true,
        repeat: true,
      },
    ],
  },
  {
    label: "keymap.group.voice",
    actions: [
      {
        id: "toggleMute",
        label: "keymap.action.toggleMute",
        key: "Mod+Shift+M",
        typing: true,
        global: true,
      },
      {
        id: "toggleDeafen",
        label: "keymap.action.toggleDeafen",
        key: "Mod+Shift+D",
        typing: true,
        global: true,
      },
    ],
  },
  {
    label: "keymap.group.app",
    actions: [
      {
        id: "openSettings",
        label: "keymap.action.openSettings",
        key: "Mod+,",
        typing: true,
      },
      {
        id: "showShortcuts",
        label: "keymap.action.showShortcuts",
        key: "Mod+/",
        typing: true,
        global: true,
      },
    ],
  },
] as const satisfies readonly GroupSpec[]

export type ActionId = (typeof GROUPS)[number]["actions"][number]["id"]

export type Action = ActionSpec & { id: ActionId }

export type ActionGroup = { label: MessageKey; actions: readonly Action[] }

export const ACTION_GROUPS: readonly ActionGroup[] = GROUPS

export const ACTIONS: readonly Action[] = GROUPS.flatMap(
  (group): readonly Action[] => group.actions,
)

export const ACTION_BY_ID = Object.fromEntries(
  ACTIONS.map(action => [action.id, action]),
) as Record<ActionId, Action>
