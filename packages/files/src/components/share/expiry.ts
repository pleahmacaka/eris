const HOUR = 3_600_000
const DAY = 24 * HOUR

export type ExpiryPreset = "hour" | "day" | "week" | "month" | "never"

export const EXPIRY_PRESETS: ExpiryPreset[] = [
  "hour",
  "day",
  "week",
  "month",
  "never",
]

const SPANS: Record<ExpiryPreset, number | null> = {
  hour: HOUR,
  day: DAY,
  week: 7 * DAY,
  month: 30 * DAY,
  never: null,
}

export const expiryFrom = (preset: ExpiryPreset, now = Date.now()) => {
  const span = SPANS[preset]

  return span === null ? null : now + span
}

const pad = (value: number) => String(value).padStart(2, "0")

export const toLocalInput = (at: number) => {
  const date = new Date(at)

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
