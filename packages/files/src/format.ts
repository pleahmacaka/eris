const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"]

const numbers = new Map<string, Intl.NumberFormat>()

const dates = new Map<string, Intl.DateTimeFormat>()

const collators = new Map<string, Intl.Collator>()

const numberFormat = (locale: string) => {
  const hit = numbers.get(locale)

  if (hit) {
    return hit
  }

  const created = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })

  numbers.set(locale, created)

  return created
}

export const formatBytes = (bytes: number, locale: string) => {
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${numberFormat(locale).format(value)} ${UNITS[unit]}`
}

export const formatKilobytes = (bytes: number, locale: string) =>
  `${numberFormat(locale).format(Math.ceil(bytes / 1024))} KB`

export const formatDate = (stamp: number, locale: string) => {
  if (!stamp) {
    return ""
  }

  let format = dates.get(locale)

  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
    })

    dates.set(locale, format)
  }

  return format.format(stamp)
}

export const collator = (locale: string) => {
  let found = collators.get(locale)

  if (!found) {
    found = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
    collators.set(locale, found)
  }

  return found
}
