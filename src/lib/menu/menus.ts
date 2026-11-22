import type { MenuItem, MenuSection } from "./items"

type Run = () => void

const shortcut = (key: string, mac: boolean) =>
  mac ? `⌘${key}` : `Ctrl+${key}`

const when = (condition: boolean, item: MenuItem): MenuItem[] =>
  condition ? [item] : []

export const selectionMenu = (
  text: string,
  copy: Run,
  mac: boolean,
): MenuSection[] =>
  text === ""
    ? []
    : [
        [
          {
            id: "copy-selection",
            label: { key: "menu.copy" },
            icon: "lucide:copy",
            hint: shortcut("C", mac),
            run: copy,
          },
        ],
      ]

export type FieldMenuState = {
  selected: boolean
  filled: boolean
  secret: boolean
}

export type FieldMenuActions = {
  cut: Run
  copy: Run
  paste: Run
  selectAll: Run
}

export const fieldMenu = (
  state: FieldMenuState,
  actions: FieldMenuActions,
  mac: boolean,
): MenuSection[] => {
  const locked = !state.selected || state.secret

  return [
    [
      {
        id: "cut",
        label: { key: "menu.cut" },
        icon: "lucide:scissors",
        hint: shortcut("X", mac),
        disabled: locked,
        run: actions.cut,
      },
      {
        id: "copy",
        label: { key: "menu.copy" },
        icon: "lucide:copy",
        hint: shortcut("C", mac),
        disabled: locked,
        run: actions.copy,
      },
      {
        id: "paste",
        label: { key: "menu.paste" },
        icon: "lucide:clipboard-paste",
        hint: shortcut("V", mac),
        run: actions.paste,
      },
    ],
    [
      {
        id: "select-all",
        label: { key: "menu.selectAll" },
        icon: "lucide:text-select",
        hint: shortcut("A", mac),
        disabled: !state.filled,
        run: actions.selectAll,
      },
    ],
  ]
}

export type MessageMenuState = { pending: boolean; removable: boolean }

export type MessageMenuActions = {
  copyText: Run
  copyLink: Run
  remove: Run
  copyId: Run
}

export const messageMenu = (
  state: MessageMenuState,
  actions: MessageMenuActions,
): MenuSection[] => {
  const copyText: MenuItem = {
    id: "copy-text",
    label: { key: "menu.message.copyText" },
    icon: "lucide:copy",
    run: actions.copyText,
  }

  if (state.pending) {
    return [[copyText]]
  }

  return [
    [
      copyText,
      {
        id: "copy-link",
        label: { key: "menu.message.copyLink" },
        icon: "lucide:link",
        run: actions.copyLink,
      },
    ],
    when(state.removable, {
      id: "delete",
      label: { key: "menu.message.delete" },
      icon: "lucide:trash-2",
      danger: true,
      run: actions.remove,
    }),
    [
      {
        id: "copy-id",
        label: { key: "menu.message.copyId" },
        icon: "lucide:id-card",
        run: actions.copyId,
      },
    ],
  ]
}

export type RoomKind = "channel" | "room" | "server"

export type RoomMenuState = {
  kind: RoomKind
  voice: boolean
  joined: boolean
  unread: boolean
  inCall: boolean
  callReady: boolean
  canInvite: boolean
  canManage: boolean
}

export type RoomMenuActions = {
  open: Run
  leaveCall: Run
  markRead: Run
  invite: Run
  copyLink: Run
  settings: Run
  leave: Run
  copyId: Run
}

const callItems = (
  state: RoomMenuState,
  actions: RoomMenuActions,
): MenuItem[] => {
  if (!state.voice) {
    return []
  }

  return state.inCall
    ? [
        {
          id: "leave-call",
          label: { key: "menu.room.leaveCall" },
          icon: "lucide:phone-off",
          run: actions.leaveCall,
        },
      ]
    : [
        {
          id: "join-call",
          label: { key: "menu.room.joinCall" },
          icon: "lucide:phone",
          disabled: !state.callReady,
          run: actions.open,
        },
      ]
}

export const roomMenu = (
  state: RoomMenuState,
  actions: RoomMenuActions,
): MenuSection[] => {
  const copyLink: MenuItem = {
    id: "copy-link",
    label: { key: "menu.room.copyLink" },
    icon: "lucide:link",
    run: actions.copyLink,
  }
  const copyId: MenuItem = {
    id: "copy-id",
    label: { key: "menu.room.copyId", values: { kind: state.kind } },
    icon: "lucide:id-card",
    run: actions.copyId,
  }

  if (!state.joined) {
    return [
      [
        {
          id: "join",
          label: { key: "menu.room.join", values: { kind: state.kind } },
          icon: "lucide:log-in",
          run: actions.open,
        },
      ],
      [copyLink],
      [copyId],
    ]
  }

  return [
    [
      ...callItems(state, actions),
      {
        id: "mark-read",
        label: { key: "menu.markRead" },
        icon: "lucide:check-check",
        disabled: !state.unread,
        run: actions.markRead,
      },
    ],
    [
      ...when(state.canInvite, {
        id: "invite",
        label: { key: "menu.room.invite" },
        icon: "lucide:user-plus",
        run: actions.invite,
      }),
      copyLink,
    ],
    when(state.canManage, {
      id: "settings",
      label: { key: "menu.room.settings", values: { kind: state.kind } },
      icon: "lucide:settings",
      run: actions.settings,
    }),
    [
      {
        id: "leave",
        label: { key: "menu.room.leave", values: { kind: state.kind } },
        icon: "lucide:log-out",
        danger: true,
        run: actions.leave,
      },
    ],
    [copyId],
  ]
}

export type DmMenuState = { unread: boolean; peer: boolean }

export type DmMenuActions = { markRead: Run; leave: Run; copyUserId: Run }

export const dmMenu = (
  state: DmMenuState,
  actions: DmMenuActions,
): MenuSection[] => [
  [
    {
      id: "mark-read",
      label: { key: "menu.markRead" },
      icon: "lucide:check-check",
      disabled: !state.unread,
      run: actions.markRead,
    },
  ],
  [
    {
      id: "leave",
      label: { key: "menu.dm.leave" },
      icon: "lucide:log-out",
      danger: true,
      run: actions.leave,
    },
  ],
  when(state.peer, {
    id: "copy-user-id",
    label: { key: "menu.user.copyId" },
    icon: "lucide:id-card",
    run: actions.copyUserId,
  }),
]

export type UserMenuState = {
  self: boolean
  mention: boolean
  role: boolean
  kick: boolean
  ban: boolean
}

export type UserMenuActions = {
  message: Run
  mention: Run
  changeRole: Run
  kick: Run
  ban: Run
  copyId: Run
}

export const userMenu = (
  state: UserMenuState,
  actions: UserMenuActions,
): MenuSection[] => [
  [
    ...when(!state.self, {
      id: "message",
      label: { key: "menu.user.message" },
      icon: "lucide:message-square",
      run: actions.message,
    }),
    ...when(state.mention, {
      id: "mention",
      label: { key: "menu.user.mention" },
      icon: "lucide:at-sign",
      run: actions.mention,
    }),
  ],
  when(state.role, {
    id: "change-role",
    label: { key: "menu.user.changeRole" },
    icon: "lucide:shield",
    run: actions.changeRole,
  }),
  [
    ...when(state.kick, {
      id: "kick",
      label: { key: "menu.user.kick" },
      icon: "lucide:user-minus",
      danger: true,
      run: actions.kick,
    }),
    ...when(state.ban, {
      id: "ban",
      label: { key: "menu.user.ban" },
      icon: "lucide:ban",
      danger: true,
      run: actions.ban,
    }),
  ],
  [
    {
      id: "copy-user-id",
      label: { key: "menu.user.copyId" },
      icon: "lucide:id-card",
      run: actions.copyId,
    },
  ],
]

export const homeMenu = (unread: boolean, markRead: Run): MenuSection[] => [
  [
    {
      id: "mark-all-read",
      label: { key: "menu.markAllRead" },
      icon: "lucide:check-check",
      disabled: !unread,
      run: markRead,
    },
  ],
]

export const inviteMenu = (
  busy: boolean,
  actions: { accept: Run; decline: Run },
): MenuSection[] => [
  [
    {
      id: "accept",
      label: { key: "menu.invite.accept" },
      icon: "lucide:check",
      disabled: busy,
      run: actions.accept,
    },
    {
      id: "decline",
      label: { key: "menu.invite.decline" },
      icon: "lucide:x",
      disabled: busy,
      run: actions.decline,
    },
  ],
]
