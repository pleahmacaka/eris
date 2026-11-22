import type { LocaleTag } from "./locales"

const RELATIVE_UNITS = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
] as const

const SIZE_UNITS = [
  "byte",
  "kilobyte",
  "megabyte",
  "gigabyte",
  "terabyte",
] as const

const relativeUnit = (seconds: number) =>
  RELATIVE_UNITS.find(([, size]) => Math.abs(seconds) >= size) ??
  RELATIVE_UNITS[RELATIVE_UNITS.length - 1]

const sizeExponent = (bytes: number) =>
  bytes < 1000
    ? 0
    : Math.min(Math.floor(Math.log10(bytes) / 3), SIZE_UNITS.length - 1)

export const createFormatters = (locale: LocaleTag) => {
  const numbers = new Intl.NumberFormat(locale)
  const times = new Intl.DateTimeFormat(locale, { timeStyle: "short" })
  const dateTimes = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  })
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  return {
    number: (value: number) => numbers.format(value),

    date: (
      value: Date | number,
      options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
    ) => new Intl.DateTimeFormat(locale, options).format(value),

    time: (value: Date | number) => times.format(value),

    dateTime: (value: Date | number) => dateTimes.format(value),

    relative: (value: Date | number, now: Date | number = Date.now()) => {
      const seconds = (Number(value) - Number(now)) / 1000
      const [unit, size] = relativeUnit(seconds)
      return relative.format(Math.round(seconds / size), unit)
    },

    fileSize: (bytes: number) => {
      const exponent = sizeExponent(bytes)
      return new Intl.NumberFormat(locale, {
        style: "unit",
        unit: SIZE_UNITS[exponent],
        unitDisplay: "short",
        maximumFractionDigits: exponent === 0 ? 0 : 1,
      }).format(bytes / 1000 ** exponent)
    },
  }
}

export type Formatters = ReturnType<typeof createFormatters>
