import type { CalendarEvent, Occurrence } from "@eris/data"
import type { EventTag } from "@eris/settings"
import { eventColors } from "./colors"

export const groupRecords = (
  stored: (CalendarEvent | undefined)[],
  group: string,
  stamp: number,
) => ({
  put: stored.flatMap(e => (e ? [{ ...e, group, updatedAt: stamp }] : [])),
  remove: [],
})

// Reordering occurrences updates their stored series, never the projected date.
// Return just changed records and leave timestamp acquisition to the write site.
export const reorderRecords = (
  day: Occurrence[],
  shown: CalendarEvent[],
  fromId: string,
  toId: string,
  after: boolean,
) => {
  if (fromId === toId) {
    return []
  }

  const next = day.filter(e => e.allDay)
  const from = next.findIndex(e => e.id === fromId)

  if (from < 0 || !next.some(e => e.id === toId)) {
    return []
  }

  const [moved] = next.splice(from, 1)
  const target = next.findIndex(e => e.id === toId)

  next.splice(after ? target + 1 : target, 0, moved)

  return next.flatMap((occ, index) => {
    const base = shown.find(e => e.id === occ.id)

    return base && base.order !== index ? [{ ...base, order: index }] : []
  })
}

export const newTag = (
  tags: EventTag[],
  id: string,
  name: string,
): EventTag => ({
  id,
  name,
  hideWhileSharing: false,
  color: eventColors[tags.length % eventColors.length],
})

export const patchTag = (
  tags: EventTag[],
  id: string,
  patch: Partial<EventTag>,
) => tags.map(tag => (tag.id === id ? { ...tag, ...patch } : tag))

export const withoutTag = (tags: EventTag[], id: string) =>
  tags.filter(tag => tag.id !== id)
