import { currentLocale, tr } from "@eris/i18n"
import { collator } from "./format"
import type { Item } from "./items"

export type Section = { id: string; label: string; items: Item[] }

const DATES = [
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "thisYear",
  "older",
] as const

const day = (date: Date, offset = 0) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset)

const firstWeekday = () => {
  try {
    return new Intl.Locale(currentLocale()).getWeekInfo().firstDay % 7
  } catch {
    return 1
  }
}

const dateBounds = (now: Date) => {
  const today = day(now)
  const week = day(today, -((today.getDay() - firstWeekday() + 7) % 7))

  return [
    today,
    day(today, -1),
    week,
    day(week, -7),
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    new Date(now.getFullYear(), 0, 1),
  ].map(date => date.getTime())
}

const bucket = (items: Item[], idOf: (item: Item) => string) => {
  const found = new Map<string, Item[]>()

  for (const item of items) {
    const id = idOf(item)
    const list = found.get(id)

    if (list) {
      list.push(item)
    } else {
      found.set(id, [item])
    }
  }

  return found
}

export const byDate = (items: Item[], newestFirst: boolean): Section[] => {
  const bounds = dateBounds(new Date())
  const found = bucket(items, item => {
    const at = bounds.findIndex(from => item.modified >= from)

    return DATES[at < 0 ? DATES.length - 1 : at]
  })

  const order = newestFirst ? DATES : [...DATES].reverse()

  return order.flatMap(id => {
    const list = found.get(id)

    return list ? [{ id, label: tr(`explorer.groups.${id}`), items: list }] : []
  })
}

export const byKind = (items: Item[], ascending: boolean): Section[] => {
  const other = tr("explorer.groups.other")
  const found = bucket(items, item => item.kind || other)
  const compare = collator(currentLocale()).compare
  const labels = [...found.keys()].sort(
    (a, b) => compare(a, b) * (ascending ? 1 : -1),
  )

  return labels.map(label => ({
    id: label,
    label,
    items: found.get(label) ?? [],
  }))
}

export const byOrder = (
  items: Item[],
  ids: string[],
  idOf: (item: Item) => string,
): Section[] => {
  const found = bucket(items, idOf)

  return ids.flatMap(id => {
    const list = found.get(id)

    return list ? [{ id, label: tr(`explorer.groups.${id}`), items: list }] : []
  })
}
