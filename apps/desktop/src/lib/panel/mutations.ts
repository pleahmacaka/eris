import {
  type CalendarEvent,
  isDone,
  type Occurrence,
  occurrenceKey,
  type Scope,
  withDone,
} from "@eris/data"
import type { EventTag } from "@eris/settings"
import type {
  editOccurrence,
  events,
  newId,
  removeOccurrence,
  updateProfileSynced,
} from "$lib/data"
import {
  groupRecords,
  newTag,
  patchTag,
  reorderRecords,
  withoutTag,
} from "./mutation-plans"
import type { Panel } from "./panel.svelte"

// One writer belongs to the Panel, not either compact/expanded detail instance.
export const panelMutations = (
  panel: Panel,
  reveal: (event: CalendarEvent) => void,
  operations: {
    events: Pick<typeof events, "put" | "get" | "apply" | "remove">
    editOccurrence: typeof editOccurrence
    removeOccurrence: typeof removeOccurrence
    updateProfileSynced: typeof updateProfileSynced
    newId: typeof newId
  },
) => {
  const {
    events,
    editOccurrence,
    removeOccurrence,
    updateProfileSynced,
    newId,
  } = operations
  let creating = false

  const editTags = (edit: (tags: EventTag[]) => EventTag[]) => {
    panel.profile.calendar.tags = edit(panel.profile.calendar.tags)
    updateProfileSynced(p => ({
      ...p,
      calendar: { ...p.calendar, tags: edit(p.calendar.tags) },
    }))
  }

  return {
    createEvent: async (next: CalendarEvent) => {
      if (creating) {
        return
      }

      creating = true

      try {
        await events.put(next)
        reveal(next)
      } finally {
        creating = false
      }
    },
    commitEvent: async (
      occurrence: Occurrence,
      next: CalendarEvent,
      scope: Scope | null,
    ) => {
      if (!occurrence.seriesDate || !scope) {
        await events.put(next)

        return
      }

      const edited = await editOccurrence(occurrence, next, scope)

      if (edited) {
        reveal({ ...edited, start: next.start })
      }
    },
    groupWith: async (moved: Occurrence, target: Occurrence) => {
      const group = target.group ?? moved.group ?? newId()
      const stored = await Promise.all([
        events.get(moved.id),
        events.get(target.id),
      ])

      await events.apply(groupRecords(stored, group, Date.now()))
    },
    ungroup: async (event: Occurrence) => {
      const stored = await events.get(event.id)

      if (stored) {
        await events.put({ ...stored, group: null, updatedAt: Date.now() })
      }
    },
    reorderDay: async (fromId: string, toId: string, after: boolean) => {
      const next = reorderRecords(
        panel.dayEvents,
        panel.shown,
        fromId,
        toId,
        after,
      )

      await Promise.all(
        next.map(base => events.put({ ...base, updatedAt: Date.now() })),
      )
    },
    remove: async (event: Occurrence) => {
      if (event.seriesDate) {
        const scope = await panel.askScope("delete")

        if (!scope) {
          return
        }

        await removeOccurrence(event, scope)
      } else {
        if (!(await panel.askScope("delete", false))) {
          return
        }

        await events.remove(event.id)
      }

      panel.close()
    },
    createTag: (name: string) => {
      const tag = newTag(panel.profile.calendar.tags, newId(), name)

      editTags(tags => [...tags, tag])

      return tag.id
    },
    updateTag: (id: string, patch: Partial<EventTag>) =>
      editTags(tags => patchTag(tags, id, patch)),
    removeTag: (id: string) => editTags(tags => withoutTag(tags, id)),
    toggleDone: async (event: Occurrence) => {
      const stored = await events.get(event.id)

      if (stored) {
        await events.put(
          withDone(stored, occurrenceKey(event), !isDone(event), Date.now()),
        )
      }
    },
  }
}
