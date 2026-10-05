// Eris and Note pair over the same p2p chain, so both read each other's
// snapshots; anything here changes the wire for both apps at once

export type AppTag = "eris" | "note"

export const crossAppCollections = ["events"] as const

export const crossesApps = (collection: string) =>
  (crossAppCollections as readonly string[]).includes(collection)

export const MAX_CLOCK_SKEW = 24 * 60 * 60 * 1000

export const TOMBSTONE_TTL = 30 * 24 * 60 * 60 * 1000
