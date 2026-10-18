import { expect, mock, test } from "bun:test"
import type { CalendarEvent, Occurrence, Scope } from "@eris/data"
import { defaultProfile, type Profile } from "@eris/settings"
import {
  groupRecords,
  reorderRecords,
} from "../../../src/lib/panel/mutation-plans"
import { panelMutations } from "../../../src/lib/panel/mutations"
import type { Panel } from "../../../src/lib/panel/panel.svelte"
import { eventFixture } from "./test-fixtures"

const setup = () => {
  const records = new Map<string, CalendarEvent>()
  const get = mock(async (id: string) => records.get(id))
  const put = mock(async (next: CalendarEvent) => {
    records.set(next.id, next)
    return next
  })
  const apply = mock(
    async (_plan: { put: CalendarEvent[]; remove: string[] }) => {},
  )
  const remove = mock(async (_id: string) => {})
  const editOccurrence = mock(
    async (
      _occurrence: Occurrence,
      _next: CalendarEvent,
      _scope: Scope,
    ): Promise<CalendarEvent | null> => null,
  )
  const removeOccurrence = mock(
    async (_occurrence: Occurrence, _scope: Scope) => {},
  )
  let synced = structuredClone(defaultProfile)
  const updateProfileSynced = mock(
    async (update: (profile: Profile) => Profile) => {
      synced = update(synced)
    },
  )
  const panel = {
    profile: structuredClone(defaultProfile),
    dayEvents: [] as Occurrence[],
    shown: [] as CalendarEvent[],
    askScope: mock(async (): Promise<Scope | null> => "all"),
    close: mock(() => {}),
  }
  const reveal = mock((_event: CalendarEvent) => {})
  const mutations = panelMutations(panel as unknown as Panel, reveal, {
    events: { get, put, apply, remove },
    editOccurrence,
    removeOccurrence,
    updateProfileSynced,
    newId: () => crypto.randomUUID(),
  })

  return {
    records,
    panel,
    reveal,
    mutations,
    get,
    put,
    apply,
    remove,
    editOccurrence,
    removeOccurrence,
    updateProfileSynced,
    get synced() {
      return synced
    },
  }
}

test("one panel creation guard covers both detail instances and releases on failure", async () => {
  const context = setup()
  const pending = Promise.withResolvers<CalendarEvent>()

  context.put.mockImplementationOnce(() => pending.promise)
  const first = context.mutations.createEvent(eventFixture())
  await context.mutations.createEvent(eventFixture({ id: "duplicate" }))
  expect(context.put).toHaveBeenCalledTimes(1)
  expect(context.reveal).not.toHaveBeenCalled()
  pending.reject(new Error("disk"))
  await expect(first).rejects.toThrow("disk")
  await context.mutations.createEvent(eventFixture({ id: "retry" }))
  expect(context.put).toHaveBeenCalledTimes(2)
  expect(context.reveal.mock.calls[0][0].id).toBe("retry")
})

test("a recurring split reveals the new identity at the edited date", async () => {
  const context = setup()
  const occurrence = {
    ...eventFixture({ recurrence: "daily" }),
    seriesDate: "2026-03-08",
  }
  const next = eventFixture({ start: "2026-03-09" })

  context.editOccurrence.mockResolvedValueOnce(
    eventFixture({ id: "split", start: "2026-03-07" }),
  )
  await context.mutations.commitEvent(occurrence, next, "following")
  expect(context.put).not.toHaveBeenCalled()
  expect(context.reveal.mock.calls[0][0]).toMatchObject({
    id: "split",
    start: "2026-03-09",
  })
  await context.mutations.commitEvent(eventFixture(), next, null)
  expect(context.put).toHaveBeenCalledWith(next)
})

test("group planning skips missing records, retains stored dates, and shares one stamp", () => {
  const stored = eventFixture({ start: "2026-03-01", order: 4 })
  const plan = groupRecords([stored, undefined], "g", 100)

  expect(plan).toEqual({
    put: [{ ...stored, group: "g", updatedAt: 100 }],
    remove: [],
  })
  expect(stored.group).toBeUndefined()
})

test("group workflow prefers target group and edits stored bases, not occurrences", async () => {
  const context = setup()
  const moved = eventFixture({ id: "moved", group: "old" })
  const target = eventFixture({ id: "target", group: "target-group" })

  context.records.set(moved.id, moved)
  context.records.set(target.id, target)
  await context.mutations.groupWith(
    { ...moved, start: "2026-03-09", seriesDate: "2026-03-09" },
    target,
  )
  const plan = context.apply.mock.calls[0][0]
  expect(plan.put.map(e => e.group)).toEqual(["target-group", "target-group"])
  expect(plan.put[0].start).toBe("2026-03-07")
  expect(plan.put[0].updatedAt).toBe(plan.put[1].updatedAt)
})

test("reorder ignores timed/missing targets and writes only changed stored records", () => {
  const a = eventFixture({ id: "a", order: 0 })
  const b = eventFixture({ id: "b", order: 1, recurrence: "daily" })
  const c = eventFixture({ id: "c", order: 2 })
  const timed = eventFixture({ id: "timed", allDay: false })
  const day = [a, { ...b, start: "2026-03-09" }, c, timed]
  const shown = [a, b, c, timed]
  const next = reorderRecords(day, shown, "b", "a", false)

  expect(next.map(e => [e.id, e.order])).toEqual([
    ["b", 0],
    ["a", 1],
  ])
  expect(next[0].start).toBe(b.start)
  expect(reorderRecords(day, shown, "a", "a", false)).toEqual([])
  expect(reorderRecords(day, shown, "a", "timed", false)).toEqual([])
  expect(reorderRecords(day, shown, "missing", "a", false)).toEqual([])
  expect(reorderRecords(day, shown, "a", "b", true).map(e => e.id)).toEqual([
    "b",
    "a",
  ])
  expect(shown.map(e => e.order)).toEqual([0, 1, 2, undefined])
})

test("delete cancellation does not remove or close, recurring deletion keeps its scope", async () => {
  const context = setup()

  context.panel.askScope.mockResolvedValueOnce(null)
  await context.mutations.remove(eventFixture())
  expect(context.remove).not.toHaveBeenCalled()
  expect(context.panel.close).not.toHaveBeenCalled()
  const occurrence = { ...eventFixture(), seriesDate: "2026-03-08" }
  await context.mutations.remove(occurrence)
  expect(context.removeOccurrence).toHaveBeenCalledWith(occurrence, "all")
  expect(context.panel.close).toHaveBeenCalledTimes(1)
  expect(context.remove).not.toHaveBeenCalled()
})

test("tag edits apply to local state and synced profile without dropping other tags", () => {
  const context = setup()
  const id = context.mutations.createTag("Personal")

  context.mutations.updateTag(id, { hideWhileSharing: true })
  expect(
    context.panel.profile.calendar.tags.find(tag => tag.id === id),
  ).toMatchObject({ name: "Personal", hideWhileSharing: true })
  expect(context.synced.calendar.tags.find(tag => tag.id === id)).toMatchObject(
    {
      name: "Personal",
      hideWhileSharing: true,
    },
  )
  context.mutations.removeTag(id)
  expect(context.panel.profile.calendar.tags.some(tag => tag.id === id)).toBe(
    false,
  )
})
