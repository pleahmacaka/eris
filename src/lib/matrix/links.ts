import { serverName } from "./rooms"

const MATRIX_TO = "https://matrix.to/#/"

const VIA_LIMIT = 3

export const viaServers = (userIds: string[], limit = VIA_LIMIT) => {
  const counts = new Map<string, number>()

  for (const userId of userIds) {
    const server = serverName(userId)

    if (server !== "") {
      counts.set(server, (counts.get(server) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .slice(0, limit)
    .map(([server]) => server)
}

const viaQuery = (via: string[]) =>
  via.length === 0
    ? ""
    : `?${via.map(server => `via=${encodeURIComponent(server)}`).join("&")}`

export const roomPermalink = (roomIdOrAlias: string, via: string[] = []) =>
  `${MATRIX_TO}${encodeURIComponent(roomIdOrAlias)}${
    roomIdOrAlias.startsWith("#") ? "" : viaQuery(via)
  }`

export const eventPermalink = (
  roomId: string,
  eventId: string,
  via: string[] = [],
) =>
  `${MATRIX_TO}${encodeURIComponent(roomId)}/${encodeURIComponent(eventId)}${viaQuery(via)}`
