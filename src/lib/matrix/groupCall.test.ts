import { describe, expect, test } from "bun:test"
import {
  GROUP_CALL_LABEL,
  livekitServiceUrlFromWellKnown,
  type MembershipDigest,
  mergeParticipants,
  oldestTransport,
  participantIdentity,
  phaseFromConnection,
  pickLivekitServiceUrl,
  splitIdentity,
} from "./groupCall"

const membership = (
  overrides: Partial<MembershipDigest>,
): MembershipDigest => ({
  userId: "@alice:example.org",
  deviceId: "AAA",
  memberId: "@alice:example.org:AAA",
  createdTs: 1,
  transport: { type: "livekit", livekit_service_url: "https://sfu.a" },
  ...overrides,
})

describe("transport discovery", () => {
  const transports = [
    { type: "other" },
    { type: "livekit", livekit_service_url: "https://sfu.transports/" },
  ]
  const wellKnown = {
    "m.homeserver": { base_url: "https://example.org/" },
    "org.matrix.msc4143.rtc_foci": [
      { type: "livekit", livekit_service_url: "https://sfu.well-known" },
    ],
  }

  test("prefers the rtc transports endpoint over the well-known", () => {
    expect(pickLivekitServiceUrl(transports, wellKnown)).toBe(
      "https://sfu.transports",
    )
  })

  test("falls back to the well-known rtc foci", () => {
    expect(pickLivekitServiceUrl(undefined, wellKnown)).toBe(
      "https://sfu.well-known",
    )
    expect(pickLivekitServiceUrl([{ type: "x" }], wellKnown)).toBe(
      "https://sfu.well-known",
    )
  })

  test("reports no service when neither source lists livekit", () => {
    expect(pickLivekitServiceUrl(undefined, undefined)).toBeNull()
    expect(
      pickLivekitServiceUrl([{ type: "x" }], {
        "org.matrix.msc4143.rtc_foci": [{ type: "x" }],
      }),
    ).toBeNull()
    expect(livekitServiceUrlFromWellKnown("nope")).toBeNull()
  })

  test("uses the oldest membership's livekit transport", () => {
    const transport = oldestTransport([
      membership({
        createdTs: 20,
        transport: { type: "livekit", livekit_service_url: "https://sfu.new" },
      }),
      membership({ createdTs: 5, transport: { type: "unknown" } }),
      membership({
        createdTs: 10,
        transport: { type: "livekit", livekit_service_url: "https://sfu.old" },
      }),
    ])

    expect(transport?.livekit_service_url).toBe("https://sfu.old")
    expect(oldestTransport([])).toBeUndefined()
  })
})

describe("identities", () => {
  test("builds and splits the user:device identity", () => {
    const identity = participantIdentity("@alice:example.org", "AAA")

    expect(identity).toBe("@alice:example.org:AAA")
    expect(splitIdentity(identity)).toEqual({
      userId: "@alice:example.org",
      deviceId: "AAA",
    })
  })
})

describe("mergeParticipants", () => {
  const me = { userId: "@alice:example.org", deviceId: "AAA" }
  const profileOf = (userId: string) => ({
    name: userId.slice(1, userId.indexOf(":")),
    avatarUrl: `mxc://example.org/${userId.slice(1, userId.indexOf(":"))}`,
  })

  test("marks members connected, speaking and muted from livekit state", () => {
    const list = mergeParticipants(
      [
        membership({ createdTs: 2 }),
        membership({
          userId: "@bob:example.org",
          deviceId: "BBB",
          memberId: "@bob:example.org:BBB",
          createdTs: 1,
        }),
      ],
      [{ identity: "@bob:example.org:BBB", speaking: true, micEnabled: false }],
      me,
      profileOf,
    )

    expect(list.map(p => p.name)).toEqual(["bob", "alice"])
    expect(list[0]).toMatchObject({
      connected: true,
      speaking: true,
      muted: true,
      me: false,
    })
    expect(list[1]).toMatchObject({
      connected: false,
      speaking: false,
      muted: false,
      me: true,
    })
  })

  test("keeps livekit participants that have no membership yet", () => {
    const list = mergeParticipants(
      [],
      [
        {
          identity: "@carol:example.org:CCC",
          speaking: false,
          micEnabled: true,
        },
      ],
      me,
      profileOf,
    )

    expect(list).toEqual([
      {
        key: "@carol:example.org:CCC",
        userId: "@carol:example.org",
        deviceId: "CCC",
        name: "carol",
        avatarUrl: "mxc://example.org/carol",
        me: false,
        connected: true,
        speaking: false,
        muted: false,
      },
    ])
  })
})

describe("phases", () => {
  test("maps livekit connection states to call phases", () => {
    expect(phaseFromConnection("connecting")).toBe("joining")
    expect(phaseFromConnection("connected")).toBe("connected")
    expect(phaseFromConnection("reconnecting")).toBe("reconnecting")
    expect(phaseFromConnection("signalReconnecting")).toBe("reconnecting")
    expect(phaseFromConnection("disconnected")).toBe("idle")
  })

  test("labels every phase", () => {
    expect(Object.values(GROUP_CALL_LABEL)).toEqual([
      "voice.phase.idle",
      "voice.phase.joining",
      "voice.phase.connected",
      "voice.phase.reconnecting",
      "voice.phase.leaving",
    ])
  })
})
