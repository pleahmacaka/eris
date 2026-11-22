export type UserTarget = { kind: "user"; userId: string }

export type RoomTarget = {
  kind: "room"
  roomId: string | null
  alias: string | null
  via: string[]
}

export type MentionTarget = UserTarget | RoomTarget | { kind: "everyone" }

export type MentionPick = { label: string; target: MentionTarget }

export type MentionSpan = MentionPick & { start: number; end: number }

export type MentionTrigger = "@" | "#"

export type MentionQuery = {
  trigger: MentionTrigger
  query: string
  start: number
}

export type MentionOption = {
  key: string
  kind: MentionTarget["kind"]
  title: string
  detail: string
  avatarUrl: string | null
}

export const ROOM_MENTION_LABEL = "@room"

const MATRIX_TO = "https://matrix.to/#/"

const HTML_FORMAT = "org.matrix.custom.html"

const EDGE_PUNCTUATION = ".,!?;:()[]<>\"'"

const WHITESPACE = " \n\t\r"

const OPTION_LIMIT = 8

const isSpace = (char: string | undefined) =>
  char !== undefined && WHITESPACE.includes(char)

const allPunctuation = (value: string) =>
  [...value].every(char => EDGE_PUNCTUATION.includes(char))

const ASCII_LIMIT = 127

const endsLabel = (rest: string) =>
  allPunctuation(rest) || (rest.codePointAt(0) ?? 0) > ASCII_LIMIT

const tokenStart = (text: string, index: number) => {
  let start = index

  while (start > 0 && !isSpace(text[start - 1])) {
    start -= 1
  }

  return start
}

const tokenEnd = (text: string, index: number) => {
  let end = index

  while (end < text.length && !isSpace(text[end])) {
    end += 1
  }

  return end
}

export const mentionQuery = (
  text: string,
  caret: number,
): MentionQuery | null => {
  const start = tokenStart(text, caret)
  const trigger = text[start]

  return trigger === "@" || trigger === "#"
    ? { trigger, query: text.slice(start + 1, caret), start }
    : null
}

const pickAt = (text: string, index: number, picks: MentionPick[]) =>
  picks.find(pick => {
    const end = index + pick.label.length

    return (
      text.startsWith(pick.label, index) &&
      allPunctuation(text.slice(tokenStart(text, index), index)) &&
      endsLabel(text.slice(end, tokenEnd(text, end)))
    )
  })

export const findMentions = (
  text: string,
  picks: MentionPick[],
): MentionSpan[] => {
  const ordered = [...picks].sort((a, b) => b.label.length - a.label.length)
  const spans: MentionSpan[] = []
  let index = 0

  while (index < text.length) {
    const pick =
      text[index] === "@" || text[index] === "#"
        ? pickAt(text, index, ordered)
        : undefined

    if (pick) {
      spans.push({ ...pick, start: index, end: index + pick.label.length })
      index += pick.label.length
    } else {
      index += 1
    }
  }

  return spans
}

export const splitByMentions = (text: string, spans: MentionSpan[]) => {
  const parts: { text: string; mention: boolean }[] = []
  let index = 0

  for (const span of spans) {
    parts.push({ text: text.slice(index, span.start), mention: false })
    parts.push({ text: text.slice(span.start, span.end), mention: true })
    index = span.end
  }

  parts.push({ text: text.slice(index), mention: false })

  return parts.filter(part => part.text !== "")
}

export const matrixToUrl = (target: UserTarget | RoomTarget) => {
  if (target.kind === "user") {
    return `${MATRIX_TO}${target.userId}`
  }

  if (target.alias) {
    return `${MATRIX_TO}${target.alias}`
  }

  const via = target.via.map(server => `via=${encodeURIComponent(server)}`)

  return `${MATRIX_TO}${target.roomId}${via.length > 0 ? `?${via.join("&")}` : ""}`
}

const decode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const parseMatrixTo = (href: string): UserTarget | RoomTarget | null => {
  if (!href.startsWith(MATRIX_TO)) {
    return null
  }

  const [path = "", query = ""] = href.slice(MATRIX_TO.length).split("?")
  const decoded = decode(path)

  if (decoded.startsWith("@") && decoded.length > 1) {
    return { kind: "user", userId: decoded }
  }

  const identifier = decoded.split("/")[0] ?? ""

  if (identifier.length < 2) {
    return null
  }

  const via = new URLSearchParams(query).getAll("via")

  if (identifier.startsWith("#")) {
    return { kind: "room", roomId: null, alias: identifier, via }
  }

  return identifier.startsWith("!")
    ? { kind: "room", roomId: identifier, alias: null, via }
    : null
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("\n", "<br>")

const formattedBody = (text: string, spans: MentionSpan[]) => {
  let html = ""
  let index = 0

  for (const span of spans) {
    const label = escapeHtml(span.label)

    html += escapeHtml(text.slice(index, span.start))
    html +=
      span.target.kind === "everyone"
        ? label
        : `<a href="${escapeHtml(matrixToUrl(span.target))}">${label}</a>`
    index = span.end
  }

  return html + escapeHtml(text.slice(index))
}

export const messageContent = (text: string, spans: MentionSpan[]) => {
  const userIds = [
    ...new Set(
      spans.flatMap(span =>
        span.target.kind === "user" ? [span.target.userId] : [],
      ),
    ),
  ]
  const everyone = spans.some(span => span.target.kind === "everyone")
  const linked = spans.some(span => span.target.kind !== "everyone")

  return {
    msgtype: "m.text" as const,
    body: text,
    ...(linked
      ? { format: HTML_FORMAT, formatted_body: formattedBody(text, spans) }
      : {}),
    "m.mentions": {
      ...(userIds.length > 0 ? { user_ids: userIds } : {}),
      ...(everyone ? { room: true } : {}),
    },
  }
}

export const formattedBodyOf = (content: Record<string, unknown>) =>
  content.format === HTML_FORMAT && typeof content.formatted_body === "string"
    ? content.formatted_body
    : null

export const mentionsUser = (
  content: Record<string, unknown>,
  userId: string,
) => {
  const mentions = content["m.mentions"]

  if (typeof mentions !== "object" || mentions === null) {
    return false
  }

  const { user_ids: userIds, room } = mentions as Record<string, unknown>

  return room === true || (Array.isArray(userIds) && userIds.includes(userId))
}

const rank = (query: string, fields: string[]) => {
  const needle = query.toLowerCase()
  const values = fields.map(field => field.toLowerCase())

  if (values.some(value => value.startsWith(needle))) {
    return 0
  }

  return values.some(value => value.includes(needle)) ? 1 : null
}

const best = <T>(items: T[], query: string, fieldsOf: (item: T) => string[]) =>
  items
    .map(item => ({ item, rank: rank(query, fieldsOf(item)) }))
    .filter(entry => entry.rank !== null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .slice(0, OPTION_LIMIT)
    .map(entry => entry.item)

export const userOptions = (
  members: { userId: string; name: string; avatarUrl: string | null }[],
  query: string,
  canMentionRoom: boolean,
): MentionOption[] => {
  const everyone: MentionOption[] =
    canMentionRoom && rank(query, ["room"]) === 0
      ? [
          {
            key: ROOM_MENTION_LABEL,
            kind: "everyone",
            title: ROOM_MENTION_LABEL,
            detail: "",
            avatarUrl: null,
          },
        ]
      : []

  return [
    ...best(members, query, member => [
      member.name,
      member.userId.slice(1),
    ]).map(
      (member): MentionOption => ({
        key: member.userId,
        kind: "user",
        title: member.name,
        detail: member.userId,
        avatarUrl: member.avatarUrl,
      }),
    ),
    ...everyone,
  ]
}

export const roomOptions = (
  rooms: { id: string; name: string; topic: string }[],
  query: string,
): MentionOption[] =>
  best(rooms, query, room => [room.name]).map(room => ({
    key: room.id,
    kind: "room",
    title: room.name,
    detail: room.topic,
    avatarUrl: null,
  }))

export const mentionInsertion = (userId: string, before: string) => {
  const glued = before !== "" && before.trimEnd() === before

  return `${glued ? " " : ""}${userId} `
}
