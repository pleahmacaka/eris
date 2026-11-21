import { describe, expect, test } from "bun:test"
import { groupMembers, isOnline, type MemberDigest, roleFor } from "./members"

const member = (overrides: Partial<MemberDigest>): MemberDigest => ({
  userId: "@a:example.org",
  name: "a",
  avatarUrl: null,
  powerLevel: 0,
  presence: undefined,
  ...overrides,
})

describe("roles", () => {
  test("maps power levels to roles", () => {
    expect(roleFor(100)).toBe("admin")
    expect(roleFor(50)).toBe("moderator")
    expect(roleFor(49)).toBe("member")
  })

  test("treats unavailable as online", () => {
    expect(isOnline("online")).toBe(true)
    expect(isOnline("unavailable")).toBe(true)
    expect(isOnline("offline")).toBe(false)
    expect(isOnline(undefined)).toBe(false)
  })
})

describe("groupMembers", () => {
  test("groups by role, online members first, then by name", () => {
    const groups = groupMembers([
      member({ userId: "@z", name: "z", powerLevel: 0, presence: "online" }),
      member({ userId: "@y", name: "y", powerLevel: 0, presence: "offline" }),
      member({ userId: "@x", name: "x", powerLevel: 0 }),
      member({ userId: "@mod", name: "mod", powerLevel: 50 }),
      member({ userId: "@root", name: "root", powerLevel: 100 }),
    ])

    expect(groups.map(g => g.label)).toEqual([
      "members.role.admin",
      "members.role.moderator",
      "members.role.member",
    ])
    expect(groups[2]?.members.map(m => m.userId)).toEqual(["@z", "@x", "@y"])
  })

  test("omits empty groups", () => {
    expect(groupMembers([member({})]).map(g => g.role)).toEqual(["member"])
  })
})
