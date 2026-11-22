export const SIDEBARS = {
  channels: { key: "eris.channelWidth", min: 200, max: 360, initial: 240 },
  members: { key: "eris.memberWidth", min: 200, max: 320, initial: 240 },
} as const

export type Sidebar = keyof typeof SIDEBARS

export const CHAT_MIN_WIDTH = 280

type WidthStorage = Pick<Storage, "getItem" | "setItem">

export const clampWidth = (
  side: Sidebar,
  width: number,
  limit: number = SIDEBARS[side].max,
) => {
  const { min, max } = SIDEBARS[side]

  return Math.round(
    Math.min(Math.max(width, min), Math.max(min, Math.min(max, limit))),
  )
}

export const loadWidth = (storage: WidthStorage, side: Sidebar) => {
  const stored = Number.parseFloat(storage.getItem(SIDEBARS[side].key) ?? "")

  return Number.isFinite(stored)
    ? clampWidth(side, stored)
    : SIDEBARS[side].initial
}

export const saveWidth = (
  storage: WidthStorage,
  side: Sidebar,
  width: number,
) => storage.setItem(SIDEBARS[side].key, String(clampWidth(side, width)))
