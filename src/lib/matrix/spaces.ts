export const SPACE_ROOM_TYPE = "m.space"

export const VOICE_ROOM_TYPE = "org.matrix.msc3417.call"

export type ChannelKind = "text" | "voice"

export const channelKind = (
  createType: string | null | undefined,
): ChannelKind => (createType === VOICE_ROOM_TYPE ? "voice" : "text")

export type SpaceChildLink = {
  roomId: string
  via: string[]
  order: string | undefined
  ts: number
}

export type ChannelLike = {
  id: string
  name: string
  kind: ChannelKind
  membership: string
  unread: number
  highlight: number
  order: string | undefined
  childTs: number
}

const compareOrder = (a: string | undefined, b: string | undefined) => {
  if (a === b) {
    return 0
  }

  if (a === undefined) {
    return 1
  }

  if (b === undefined) {
    return -1
  }

  return a < b ? -1 : 1
}

const byChildOrder = (a: ChannelLike, b: ChannelLike) =>
  compareOrder(a.order, b.order) ||
  a.childTs - b.childTs ||
  a.name.localeCompare(b.name, "ko")

export const sortChannels = <T extends ChannelLike>(channels: T[]) =>
  [...channels].sort(byChildOrder)

export const splitChannels = <T extends ChannelLike>(channels: T[]) => ({
  text: sortChannels(channels.filter(channel => channel.kind === "text")),
  voice: sortChannels(channels.filter(channel => channel.kind === "voice")),
})

export const spaceBadge = (
  channels: Pick<ChannelLike, "membership" | "unread" | "highlight">[],
) =>
  channels
    .filter(channel => channel.membership === "join")
    .reduce(
      (badge, channel) => ({
        unread: badge.unread + channel.unread,
        highlight: badge.highlight + channel.highlight,
      }),
      { unread: 0, highlight: 0 },
    )

export const orphanRooms = <T extends { id: string }>(
  rooms: T[],
  childIds: Set<string>,
) => rooms.filter(room => !childIds.has(room.id))

export type RoomAddress = { target: string; via: string[] }

const serverOf = (identifier: string) => {
  const colon = identifier.indexOf(":")

  return colon === -1 ? null : identifier.slice(colon + 1)
}

const MATRIX_TO = "https://matrix.to/#/"

const MATRIX_URI = "matrix:"

const decode = (segment: string) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return ""
  }
}

const splitQuery = (link: string) => {
  const mark = link.indexOf("?")

  return mark === -1
    ? { path: link, via: [] }
    : {
        path: link.slice(0, mark),
        via: new URLSearchParams(link.slice(mark + 1)).getAll("via"),
      }
}

const unwrapLink = (input: string) => {
  if (input.startsWith(MATRIX_TO)) {
    const { path, via } = splitQuery(input.slice(MATRIX_TO.length))

    return { value: decode(path.split("/")[0] ?? ""), via }
  }

  if (input.startsWith(MATRIX_URI)) {
    const { path, via } = splitQuery(input.slice(MATRIX_URI.length))
    const [kind, body = ""] = path.split("/")
    const name = decode(body)

    return {
      value: name === "" ? "" : `${kind === "r" ? "#" : "!"}${name}`,
      via,
    }
  }

  return { value: input, via: [] }
}

export const parseRoomAddress = (input: string): RoomAddress | null => {
  const { value, via } = unwrapLink(input.trim())
  const alias = value.startsWith("#")

  if (!(alias || value.startsWith("!")) || value.length === 1) {
    return null
  }

  const server = serverOf(value.slice(1))

  if (server === "" || (alias && server === null)) {
    return null
  }

  return { target: value, via: via.length > 0 ? via : server ? [server] : [] }
}
