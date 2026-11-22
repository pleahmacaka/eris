import { describe, expect, test } from "bun:test"
import type { MenuSection } from "./items"
import {
  dmMenu,
  fieldMenu,
  homeMenu,
  inviteMenu,
  messageMenu,
  type RoomMenuState,
  roomMenu,
  selectionMenu,
  type UserMenuState,
  userMenu,
} from "./menus"

const ids = (sections: MenuSection[]) =>
  sections.map(section => section.map(item => item.id))

const find = (sections: MenuSection[], id: string) =>
  sections.flat().find(item => item.id === id)

const recorder = <Name extends string>(names: Name[]) => {
  const calls: Name[] = []
  const actions = Object.fromEntries(
    names.map(name => [name, () => calls.push(name)]),
  ) as unknown as Record<Name, () => void>

  return { calls, actions }
}

describe("selectionMenu", () => {
  test("offers copy only when text is selected", () => {
    const { calls, actions } = recorder(["copy"])

    expect(selectionMenu("", actions.copy, false)).toEqual([])

    const sections = selectionMenu("선택", actions.copy, false)

    expect(ids(sections)).toEqual([["copy-selection"]])
    find(sections, "copy-selection")?.run()
    expect(calls).toEqual(["copy"])
  })
})

describe("fieldMenu", () => {
  const { actions } = recorder(["cut", "copy", "paste", "selectAll"])
  const disabled = (sections: MenuSection[]) =>
    sections
      .flat()
      .filter(item => item.disabled)
      .map(item => item.id)

  test("lists the clipboard actions, then select all", () => {
    expect(
      ids(
        fieldMenu(
          { selected: true, filled: true, secret: false },
          actions,
          false,
        ),
      ),
    ).toEqual([["cut", "copy", "paste"], ["select-all"]])
  })

  test("disables cut and copy without a selection and select all when empty", () => {
    expect(
      disabled(
        fieldMenu(
          { selected: false, filled: false, secret: false },
          actions,
          false,
        ),
      ),
    ).toEqual(["cut", "copy", "select-all"])
  })

  test("never copies out of a password field", () => {
    expect(
      disabled(
        fieldMenu(
          { selected: true, filled: true, secret: true },
          actions,
          false,
        ),
      ),
    ).toEqual(["cut", "copy"])
  })
})

describe("messageMenu", () => {
  const { calls, actions } = recorder([
    "copyText",
    "copyLink",
    "remove",
    "copyId",
  ])

  test("lets the author delete a sent message", () => {
    const sections = messageMenu({ pending: false, removable: true }, actions)

    expect(ids(sections)).toEqual([
      ["copy-text", "copy-link"],
      ["delete"],
      ["copy-id"],
    ])
    expect(find(sections, "delete")?.danger).toBe(true)
    find(sections, "delete")?.run()
    expect(calls).toEqual(["remove"])
  })

  test("hides delete on messages the user may not remove", () => {
    expect(
      ids(messageMenu({ pending: false, removable: false }, actions)),
    ).toEqual([["copy-text", "copy-link"], [], ["copy-id"]])
  })

  test("only copies the text while a message is still sending", () => {
    expect(
      ids(messageMenu({ pending: true, removable: true }, actions)),
    ).toEqual([["copy-text"]])
  })
})

describe("roomMenu", () => {
  const { calls, actions } = recorder([
    "open",
    "leaveCall",
    "markRead",
    "invite",
    "copyLink",
    "settings",
    "leave",
    "copyId",
  ])
  const state = (overrides: Partial<RoomMenuState> = {}): RoomMenuState => ({
    kind: "channel",
    voice: false,
    joined: true,
    unread: true,
    inCall: false,
    callReady: true,
    canInvite: true,
    canManage: true,
    ...overrides,
  })

  test("orders a joined text channel from reading to leaving", () => {
    const sections = roomMenu(state(), actions)

    expect(ids(sections)).toEqual([
      ["mark-read"],
      ["invite", "copy-link"],
      ["settings"],
      ["leave"],
      ["copy-id"],
    ])
    expect(find(sections, "leave")?.danger).toBe(true)
  })

  test("disables mark as read when nothing is unread", () => {
    expect(
      find(roomMenu(state({ unread: false }), actions), "mark-read")?.disabled,
    ).toBe(true)
    expect(find(roomMenu(state(), actions), "mark-read")?.disabled).toBe(false)
  })

  test("hides invite and settings without the permission", () => {
    expect(
      ids(roomMenu(state({ canInvite: false, canManage: false }), actions)),
    ).toEqual([["mark-read"], ["copy-link"], [], ["leave"], ["copy-id"]])
  })

  test("offers joining the call on a voice channel and leaving while in it", () => {
    const idle = roomMenu(state({ voice: true }), actions)
    const live = roomMenu(state({ voice: true, inCall: true }), actions)

    expect(ids(idle)[0]).toEqual(["join-call", "mark-read"])
    expect(ids(live)[0]).toEqual(["leave-call", "mark-read"])
    find(idle, "join-call")?.run()
    find(live, "leave-call")?.run()
    expect(calls).toEqual(["open", "leaveCall"])
  })

  test("disables joining the call until group calls are available", () => {
    expect(
      find(
        roomMenu(state({ voice: true, callReady: false }), actions),
        "join-call",
      )?.disabled,
    ).toBe(true)
  })

  test("only offers joining and copying for a channel the user has not joined", () => {
    expect(ids(roomMenu(state({ joined: false }), actions))).toEqual([
      ["join"],
      ["copy-link"],
      ["copy-id"],
    ])
  })
})

describe("dmMenu", () => {
  const { actions } = recorder(["markRead", "leave", "copyUserId"])

  test("copies the user id only for a one-to-one conversation", () => {
    expect(ids(dmMenu({ unread: true, peer: true }, actions))).toEqual([
      ["mark-read"],
      ["leave"],
      ["copy-user-id"],
    ])
    expect(ids(dmMenu({ unread: true, peer: false }, actions))).toEqual([
      ["mark-read"],
      ["leave"],
      [],
    ])
  })
})

describe("userMenu", () => {
  const { actions } = recorder([
    "message",
    "mention",
    "changeRole",
    "kick",
    "ban",
    "copyId",
  ])
  const state = (overrides: Partial<UserMenuState> = {}): UserMenuState => ({
    self: false,
    mention: true,
    role: false,
    kick: false,
    ban: false,
    ...overrides,
  })

  test("offers messaging, mentioning and copying for another member", () => {
    expect(ids(userMenu(state(), actions))).toEqual([
      ["message", "mention"],
      [],
      [],
      ["copy-user-id"],
    ])
  })

  test("does not offer messaging yourself", () => {
    expect(ids(userMenu(state({ self: true }), actions))[0]).toEqual([
      "mention",
    ])
  })

  test("adds moderation only when the user may use it", () => {
    const sections = userMenu(
      state({ role: true, kick: true, ban: true }),
      actions,
    )

    expect(ids(sections)).toEqual([
      ["message", "mention"],
      ["change-role"],
      ["kick", "ban"],
      ["copy-user-id"],
    ])
    expect(find(sections, "kick")?.danger).toBe(true)
    expect(find(sections, "ban")?.danger).toBe(true)
  })

  test("leaves out the mention where no composer can take it", () => {
    expect(ids(userMenu(state({ mention: false }), actions))[0]).toEqual([
      "message",
    ])
  })
})

describe("homeMenu", () => {
  test("disables mark all as read when nothing is unread", () => {
    const { calls, actions } = recorder(["markRead"])

    expect(homeMenu(false, actions.markRead)[0]?.[0]?.disabled).toBe(true)
    homeMenu(true, actions.markRead)[0]?.[0]?.run()
    expect(calls).toEqual(["markRead"])
  })
})

describe("inviteMenu", () => {
  test("offers accept and decline, disabled while a response is in flight", () => {
    const { actions } = recorder(["accept", "decline"])

    expect(ids(inviteMenu(false, actions))).toEqual([["accept", "decline"]])
    expect(
      inviteMenu(true, actions)
        .flat()
        .every(item => item.disabled),
    ).toBe(true)
  })
})
