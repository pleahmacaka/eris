import type { Message } from "#lib/i18n/translate.js"
import type { FriendDigest } from "../matrix/friends"
import type { RoomDigest } from "../matrix/rooms"
import { fold, fuzzyScore } from "./fuzzy"

export type SwitcherKind = "dm" | "text" | "voice" | "space"

export type SwitcherItem = {
  key: string
  kind: SwitcherKind
  name: string
  detail: Message
  alias: string
  avatarUrl: string | null
  spaceId: string | null
  roomId: string | null
  unread: number
}

export type SwitcherSpace = {
  id: string
  name: string
  avatarUrl: string | null
  unread: number
}

export type SwitcherRoom = Pick<
  RoomDigest,
  "id" | "name" | "avatarUrl" | "kind" | "isDm" | "unread"
>

export type SwitcherFriend = Pick<FriendDigest, "roomId" | "userId">

export type SwitcherSource = {
  spaces: readonly SwitcherSpace[]
  channels: readonly { space: SwitcherSpace; room: SwitcherRoom }[]
  dms: readonly SwitcherRoom[]
  friends: readonly SwitcherFriend[]
}

const RECENT_LIMIT = 20

const RECENT_SPAN = 10

const RECENT_WEIGHT = 3

const ALIAS_COST = 50

const FILTERS = new Map<string, SwitcherKind[]>([
  ["@", ["dm"]],
  ["#", ["text"]],
  ["!", ["voice"]],
  ["*", ["space"]],
])

const plain = (text: string): Message => ({
  key: "ui.plain",
  values: { text },
})

const dmDetail = (friend?: SwitcherFriend): Message =>
  friend ? plain(friend.userId) : { key: "channels.dm.title" }

const roomDetail = (space: SwitcherSpace | null): Message =>
  space ? plain(space.name) : { key: "switcher.detail.room" }

const roomItem = (
  room: SwitcherRoom,
  space: SwitcherSpace | null,
  friend?: SwitcherFriend,
): SwitcherItem => ({
  key: `${space?.id ?? ""}/${room.id}`,
  kind: room.isDm ? "dm" : room.kind,
  name: room.name,
  detail: room.isDm ? dmDetail(friend) : roomDetail(space),
  alias: friend?.userId ?? "",
  avatarUrl: room.avatarUrl,
  spaceId: space?.id ?? null,
  roomId: room.id,
  unread: room.unread,
})

const spaceItem = (space: SwitcherSpace): SwitcherItem => ({
  key: space.id,
  kind: "space",
  name: space.name,
  detail: { key: "switcher.detail.space" },
  alias: "",
  avatarUrl: space.avatarUrl,
  spaceId: space.id,
  roomId: null,
  unread: space.unread,
})

export const switcherItems = (source: SwitcherSource): SwitcherItem[] => {
  const friends = new Map(source.friends.map(friend => [friend.roomId, friend]))

  return [
    ...source.dms.map(room => roomItem(room, null, friends.get(room.id))),
    ...source.channels.map(({ space, room }) => roomItem(room, space)),
    ...source.spaces.map(spaceItem),
  ]
}

export const parseQuery = (input: string) => {
  const text = input.trimStart()
  const kinds = FILTERS.get(text.charAt(0)) ?? null

  return { kinds, needle: fold(kinds ? text.slice(1) : text).chars }
}

const aliasScore = (needle: string[], alias: string) => {
  const folded = fold(alias)

  return folded.chars.join("").includes(needle.join(""))
    ? fuzzyScore(needle, folded)
    : null
}

const matchScore = (needle: string[], item: SwitcherItem) => {
  const name = fuzzyScore(needle, fold(item.name))
  const alias = aliasScore(needle, item.alias)
  const scores = [name, alias === null ? null : alias - ALIAS_COST].filter(
    score => score !== null,
  )

  return scores.length === 0 ? null : Math.max(...scores)
}

export const searchSwitcher = (
  items: readonly SwitcherItem[],
  input: string,
  recent: readonly string[],
): SwitcherItem[] => {
  const { kinds, needle } = parseQuery(input)
  const pool = kinds ? items.filter(item => kinds.includes(item.kind)) : items
  const visited = (item: SwitcherItem) =>
    item.roomId === null ? -1 : recent.indexOf(item.roomId)
  const order = (item: SwitcherItem) =>
    visited(item) === -1 ? recent.length : visited(item)
  const boost = (item: SwitcherItem) =>
    visited(item) === -1
      ? 0
      : Math.max(RECENT_SPAN - visited(item), 0) * RECENT_WEIGHT

  if (needle.length === 0) {
    return [...pool].sort((a, b) => order(a) - order(b))
  }

  return pool
    .flatMap(item => {
      const score = matchScore(needle, item)

      return score === null ? [] : [{ item, score: score + boost(item) }]
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}

export const touchRecentRoom = (recent: readonly string[], roomId: string) =>
  [roomId, ...recent.filter(id => id !== roomId)].slice(0, RECENT_LIMIT)
