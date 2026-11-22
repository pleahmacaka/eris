import { describe, expect, test } from "bun:test"
import {
  applyPermissionLevels,
  CALL_MEMBER_EVENT,
  canAssignLevel,
  canChangeLevel,
  canEditLevels,
  canManage,
  canModerate,
  canRedact,
  canSetPermission,
  canUnban,
  fieldLevel,
  isSelfDemotion,
  levelKind,
  PERMISSIONS,
  permissionChoices,
  permissionLevel,
  readPermissionLevels,
  stateEventLevel,
  userLevel,
  withPermissionLevel,
} from "./power"

const content = {
  users: { "@mod:example.org": 50, "@admin:example.org": 100 },
  users_default: 0,
  events: { "m.room.power_levels": 100, [CALL_MEMBER_EVENT]: 0 },
  events_default: 0,
  state_default: 50,
  invite: 0,
  kick: 50,
  ban: 75,
  redact: 50,
}

const permission = (key: string) => {
  const found = PERMISSIONS.find(item => item.key === key)

  if (!found) {
    throw new Error(`unknown permission ${key}`)
  }

  return found
}

describe("levels", () => {
  test("falls back to the Matrix defaults for missing keys", () => {
    expect(fieldLevel({}, "state_default")).toBe(50)
    expect(fieldLevel({}, "kick")).toBe(50)
    expect(fieldLevel({}, "invite")).toBe(0)
    expect(fieldLevel({ invite: "50" }, "invite")).toBe(0)
    expect(stateEventLevel({}, "m.room.name")).toBe(50)
    expect(stateEventLevel(content, "m.room.power_levels")).toBe(100)
  })

  test("reads a user level or the room default", () => {
    expect(userLevel(content, "@mod:example.org")).toBe(50)
    expect(userLevel(content, "@new:example.org")).toBe(0)
    expect(userLevel({ users_default: 10 }, "@new:example.org")).toBe(10)
  })

  test("names presets, custom levels and room creators", () => {
    expect(levelKind(100)).toBe("admin")
    expect(levelKind(50)).toBe("moderator")
    expect(levelKind(0)).toBe("member")
    expect(levelKind(75)).toBe("custom")
    expect(levelKind(Infinity)).toBe("owner")
  })
})

describe("changing a member's level", () => {
  const admin = { actor: 100, target: 0, self: false }

  test("needs the power to send the power levels event", () => {
    expect(canEditLevels(content, 100)).toBe(true)
    expect(canEditLevels(content, 50)).toBe(false)
    expect(canChangeLevel(content, { ...admin, actor: 50 })).toBe(false)
  })

  test("never changes someone at or above the actor's own level", () => {
    expect(canChangeLevel(content, admin)).toBe(true)
    expect(canChangeLevel(content, { ...admin, target: 99 })).toBe(true)
    expect(canChangeLevel(content, { ...admin, target: 100 })).toBe(false)
    expect(canChangeLevel(content, { ...admin, target: Infinity })).toBe(false)
  })

  test("lets a member change their own level, except a room creator", () => {
    expect(
      canChangeLevel(content, { actor: 100, target: 100, self: true }),
    ).toBe(true)
    expect(
      canChangeLevel(content, {
        actor: Infinity,
        target: Infinity,
        self: true,
      }),
    ).toBe(false)
  })

  test("only assigns whole levels up to the actor's own", () => {
    expect(canAssignLevel(content, admin, 100)).toBe(true)
    expect(canAssignLevel(content, admin, 101)).toBe(false)
    expect(canAssignLevel(content, admin, 12.5)).toBe(false)
    expect(canAssignLevel(content, { ...admin, actor: Infinity }, 100)).toBe(
      true,
    )
    expect(canAssignLevel(content, { ...admin, target: 100 }, 0)).toBe(false)
  })

  test("flags lowering your own level", () => {
    const self = { actor: 100, target: 100, self: true }

    expect(isSelfDemotion(self, 50)).toBe(true)
    expect(isSelfDemotion(self, 100)).toBe(false)
    expect(isSelfDemotion(admin, 0)).toBe(false)
  })
})

describe("moderation", () => {
  test("kicks and bans only members below the actor", () => {
    const moderator = { actor: 50, target: 0, self: false }

    expect(canModerate(content, "kick", moderator)).toBe(true)
    expect(canModerate(content, "ban", moderator)).toBe(false)
    expect(canModerate(content, "ban", { ...moderator, actor: 75 })).toBe(true)
    expect(canModerate(content, "kick", { ...moderator, target: 50 })).toBe(
      false,
    )
    expect(canModerate(content, "kick", { ...moderator, self: true })).toBe(
      false,
    )
  })

  test("unbans with both the ban and kick levels", () => {
    expect(canUnban(content, 75)).toBe(true)
    expect(canUnban(content, 50)).toBe(false)
  })

  test("redacts and manages from the lowest relevant level", () => {
    expect(canRedact(content, 50)).toBe(true)
    expect(canRedact(content, 49)).toBe(false)
    expect(canManage(content, 50)).toBe(true)
    expect(canManage(content, 49)).toBe(false)
  })
})

describe("permissions", () => {
  test("reads each action from its power level key", () => {
    expect(readPermissionLevels(content)).toEqual({
      send: 0,
      invite: 0,
      kick: 50,
      ban: 75,
      redact: 50,
      state: 50,
      call: 0,
    })
  })

  test("falls back to the state default for the call membership event", () => {
    expect(permissionLevel({ state_default: 60 }, permission("call"))).toBe(60)
  })

  test("writes a level without touching the other keys", () => {
    const next = withPermissionLevel(content, permission("call"), 50)

    expect(next.events).toEqual({
      "m.room.power_levels": 100,
      [CALL_MEMBER_EVENT]: 50,
    })
    expect(next.users).toBe(content.users)
    expect(withPermissionLevel(content, permission("kick"), 100)).toMatchObject(
      { kick: 100, ban: 75 },
    )
    expect(content.kick).toBe(50)
  })

  test("refuses levels above the actor and keys the actor cannot reach", () => {
    expect(canSetPermission(content, permission("kick"), 100, 100)).toBe(true)
    expect(canSetPermission(content, permission("kick"), 100, 101)).toBe(false)
    expect(canSetPermission(content, permission("kick"), 50, 0)).toBe(false)
    expect(
      canSetPermission({ ...content, ban: 150 }, permission("ban"), 100, 50),
    ).toBe(false)
  })

  test("offers the presets plus a custom current level", () => {
    expect(permissionChoices(50)).toEqual([100, 50, 0])
    expect(permissionChoices(75)).toEqual([100, 75, 50, 0])
  })

  test("applies only the changed levels the actor may set", () => {
    const next = applyPermissionLevels(
      content,
      { ...readPermissionLevels(content), kick: 100, invite: 50, ban: 200 },
      100,
    )

    expect(next).toMatchObject({ kick: 100, invite: 50, ban: 75 })
    expect(
      applyPermissionLevels(content, readPermissionLevels(content), 100),
    ).toBe(content)
  })
})
