import type { LocaleTag } from "#lib/i18n/locales.js"
import {
  MOCK_PERMISSION_IDS,
  MOCK_ROLE_IDS,
  type MockAttachmentKind,
  type MockPermissionId,
  type MockPresence,
  type MockResultKind,
  type MockRoleId,
  type MockTextChannel,
  type MockVoiceState,
} from "#lib/landing/mock.js"
import type { MessageKey } from "./i18n/catalogs"
import type { Translate } from "./i18n/translate"

type Part = { text: string; pill: boolean }

type Attachment = { kind: MockAttachmentKind; name: string; size: string }

type Extras = { image?: boolean; attachments?: Attachment[] }

const PILL = "\u001f"

const SERVER = "ArixLab"

const OTHER_SERVERS = ["Nova", "Pixel"]

const HOMESERVER = "matrix.org"

const ME = "alice"

const BOB = "bob"

const CAROL = "carol"

const DAVE = "dave"

const ERIN = "erin"

const DEV = "dev"

const FRIENDS: { name: string; presence: MockPresence }[] = [
  { name: BOB, presence: "online" },
  { name: CAROL, presence: "away" },
  { name: DAVE, presence: "offline" },
  { name: ERIN, presence: "online" },
]

const ROLE_MEMBERS: Record<MockRoleId, number> = {
  admin: 1,
  moderator: 2,
  member: 12,
}

const MODERATOR_DENIED: MockPermissionId[] = ["ban", "state"]

export const buildMockCopy = (locale: LocaleTag, t: Translate) => {
  const count = new Intl.NumberFormat(locale)
  const fileSize = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "kilobyte",
  })
  const clock = new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone: "UTC",
  })

  const at = (hour: number, minute: number) =>
    clock.format(Date.UTC(2026, 0, 1, hour, minute))

  const plain = (text: string): Part[] => [{ text, pill: false }]

  const rich = (key: MessageKey, pills: Record<string, string>): Part[] => {
    const marked = Object.fromEntries(
      Object.entries(pills).map(([name, label]) => [
        name,
        `${PILL}${label}${PILL}`,
      ]),
    )

    return t(key, marked)
      .split(PILL)
      .map((text, index) => ({ text, pill: index % 2 === 1 }))
  }

  const line = (
    name: string,
    time: string,
    parts: Part[],
    extras: Extras = {},
  ) => ({
    name,
    time,
    mine: name === ME,
    parts,
    image: extras.image ?? false,
    attachments: extras.attachments ?? [],
  })

  const general = t("mock.channel.general")
  const lounge = t("mock.channel.lounge")

  const placeholder = (name: string) => t("mock.composer.placeholder", { name })

  const status: Record<MockPresence, string> = {
    online: t("mock.presence.online"),
    away: t("mock.presence.away"),
    offline: t("mock.presence.offline"),
  }

  const person = (name: string, presence: MockPresence) => ({
    name,
    presence,
    status: status[presence],
  })

  const threads: Record<MockTextChannel, ReturnType<typeof line>[]> = {
    general: [
      line(BOB, at(9, 38), plain(t("mock.chat.first")), { image: true }),
      line(ME, at(9, 40), plain(t("mock.chat.second")), {
        attachments: [
          { kind: "file", name: "release-notes.md", size: fileSize.format(4) },
          { kind: "audio", name: "standup.ogg", size: fileSize.format(212) },
        ],
      }),
      line(
        CAROL,
        at(9, 41),
        rich("mock.chat.third", { user: `@${ME}`, channel: `#${lounge}` }),
      ),
    ],
    dev: [
      line(DAVE, at(8, 52), plain(t("mock.thread.dev.first"))),
      line(ERIN, at(8, 55), plain(t("mock.thread.dev.second"))),
    ],
  }

  const direct = [
    line(BOB, at(10, 2), plain(t("mock.thread.bob.first"))),
    line(ME, at(10, 3), plain(t("mock.thread.bob.second"))),
  ]

  const me = person(ME, "online")
  const people = FRIENDS.map(friend => ({
    ...person(friend.name, friend.presence),
    placeholder: t("mock.composer.dm", { name: friend.name }),
    thread: friend.name === BOB ? direct : [],
  }))

  return {
    server: SERVER,
    servers: OTHER_SERVERS,
    back: t("mock.back"),
    close: t("showcase.close"),
    me,
    people,

    nav: {
      home: t("mock.nav.home"),
      friends: t("mock.nav.friends"),
      start: t("mock.dm.start"),
      direct: t("mock.dm.title"),
      text: t("mock.channels.text"),
      voice: t("mock.channels.voice"),
    },

    channels: { general, dev: DEV, lounge },

    placeholders: {
      general: placeholder(general),
      dev: placeholder(DEV),
      lounge: placeholder(lounge),
    },

    threads,

    empty: { title: t("mock.empty.title"), hint: t("mock.empty.hint") },

    home: { title: t("mock.home.title"), hint: t("mock.home.body") },

    members: [
      { role: t("mock.role.admin"), people: [me] },
      { role: t("mock.role.member"), people: people.slice(0, 3) },
    ].map(group => ({ ...group, count: count.format(group.people.length) })),

    voice: {
      status: t("mock.voice.connected"),
      phase: t("mock.voice.phase"),
      mute: t("mock.voice.mute"),
      deafen: t("mock.voice.deafen"),
      leave: t("mock.voice.leave"),
      tiles: [
        { name: ME, label: t("mock.voice.me", { name: ME }), state: "idle" },
        { name: BOB, label: BOB, state: "speaking" },
        { name: CAROL, label: CAROL, state: "muted" },
      ] satisfies { name: string; label: string; state: MockVoiceState }[],
      events: [
        { text: t("mock.voice.joined", { target: BOB }), time: at(9, 12) },
        { text: t("mock.voice.joined", { target: CAROL }), time: at(9, 14) },
      ],
    },

    friends: {
      tabs: {
        online: t("mock.friends.online"),
        all: t("mock.friends.all"),
        pending: t("mock.friends.pending"),
      },
      add: t("mock.friends.add"),
      search: t("mock.friends.search"),
      count: count.format(people.length),
      menu: {
        read: t("mock.menu.read"),
        invite: t("mock.menu.invite"),
        link: t("mock.menu.link"),
        leave: t("mock.menu.leave"),
      },
    },

    switcher: {
      title: t("mock.switcher.title"),
      keys: ["Ctrl", "K"],
      placeholder: t("mock.switcher.placeholder"),
      results: [
        { kind: "text", name: general, detail: SERVER },
        { kind: "voice", name: lounge, detail: SERVER },
        { kind: "dm", name: BOB, detail: "" },
        { kind: "server", name: SERVER, detail: t("mock.switcher.server") },
      ] satisfies { kind: MockResultKind; name: string; detail: string }[],
      filters: [
        { key: "@", label: t("mock.switcher.conversations") },
        { key: "#", label: t("mock.channels.text") },
      ],
      move: t("mock.switcher.move"),
      open: t("mock.switcher.open"),
      enter: "Enter",
    },

    settings: {
      title: t("mock.settings.title"),
      tabs: {
        overview: t("mock.settings.overview"),
        roles: t("mock.settings.roles"),
        members: t("mock.settings.members"),
      },
      roles: MOCK_ROLE_IDS.map(id => ({
        id,
        name: t(`mock.role.${id}`),
        members: count.format(ROLE_MEMBERS[id]),
      })),
      permissions: MOCK_PERMISSION_IDS.map(id => ({
        id,
        label: t(`mock.permission.${id}`),
        allowed: !MODERATOR_DENIED.includes(id),
      })),
      revert: t("mock.settings.revert"),
      save: t("mock.settings.save"),
    },

    login: {
      subtitle: t("mock.login.subtitle"),
      user: { label: t("mock.login.user"), value: `@${ME}:${HOMESERVER}` },
      server: {
        label: t("mock.login.server"),
        value: `https://${HOMESERVER}`,
        found: t("mock.login.found"),
      },
      password: t("mock.login.password"),
      submit: t("mock.login.submit"),
    },
  }
}

export type MockCopy = ReturnType<typeof buildMockCopy>

export type MockLine = MockCopy["threads"][MockTextChannel][number]
