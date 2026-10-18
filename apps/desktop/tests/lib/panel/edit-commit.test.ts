import { expect, mock, test } from "bun:test"
import type { CalendarEvent, Occurrence, Scope } from "@eris/data"
import { parseLocal } from "@eris/data"
import { draftFrom, eventFrom } from "../../../src/lib/panel/draft"
import { createDraftCommit } from "../../../src/lib/panel/edit-commit"
import { eventFixture, inTimezone } from "./test-fixtures"

const setup = (event: Occurrence | null = eventFixture()) => {
  const seed = { day: parseLocal("2026-03-07"), span: 0, parent: null }
  const state = {
    event,
    seed,
    draft: draftFrom(event, seed, null),
    reminder: null,
    creating: event === null,
  }
  const createEvent = mock(async (_next: CalendarEvent) => {})
  const commitEvent = mock(
    async (
      _event: Occurrence,
      _next: CalendarEvent,
      _scope: Scope | null,
    ) => {},
  )
  const askScope = mock(async (): Promise<Scope | null> => "one")
  const shareNotes = mock(async (_event: Occurrence, _notes: string) => {})
  const get = mock(async () => event ?? undefined)
  const commit = createDraftCommit(
    () => state,
    draft => {
      state.draft = draft
    },
    { createEvent, commitEvent, askScope, shareNotes, get, newId: () => "new" },
  )

  return { state, commit, createEvent, commitEvent, askScope, shareNotes, get }
}

test("invalid and unchanged drafts never ask for scope or write", async () => {
  const editor = setup()

  await editor.commit()
  editor.state.draft.title = ""
  await editor.commit()
  expect(editor.get).not.toHaveBeenCalled()
  expect(editor.askScope).not.toHaveBeenCalled()
  expect(editor.commitEvent).not.toHaveBeenCalled()
})

test("new drafts create only in the new view and retain range seed", async () => {
  const editor = setup(null)

  editor.state.draft = {
    ...editor.state.draft,
    title: "Trip",
    allDay: true,
    days: 2,
  }
  editor.state.creating = false
  await editor.commit()
  expect(editor.createEvent).not.toHaveBeenCalled()
  editor.state.creating = true
  await editor.commit()
  expect(editor.createEvent.mock.calls[0][0].end).toBe("2026-03-09")
})

test("notes-only synchronized occurrences bypass scope; mixed edits do not", async () => {
  const editor = setup({
    ...eventFixture({ recurrence: "daily", notesSync: true }),
    seriesDate: "2026-03-07",
  })

  editor.state.draft.notes = "shared"
  await editor.commit()
  expect(editor.shareNotes).toHaveBeenCalledTimes(1)
  expect(editor.askScope).not.toHaveBeenCalled()
  editor.state.draft.title = "Mixed"
  await editor.commit()
  expect(editor.askScope).toHaveBeenCalledTimes(1)
  expect(editor.commitEvent.mock.calls[0][2]).toBe("one")
})

test("cancelled recurrence edit restores the latest baseline without writing", async () => {
  const editor = setup({
    ...eventFixture({ recurrence: "daily" }),
    seriesDate: "2026-03-07",
  })

  editor.askScope.mockImplementation(async () => {
    if (editor.state.event) {
      editor.state.event = { ...editor.state.event, title: "Remote" }
    }
    return null
  })
  editor.state.draft.title = "Local"
  await editor.commit()
  expect(editor.state.draft.title).toBe("Remote")
  expect(editor.get).not.toHaveBeenCalled()
  expect(editor.commitEvent).not.toHaveBeenCalled()
})

test("accepted scope is reused and edits made during awaits are committed", async () => {
  const editor = setup({
    ...eventFixture({ recurrence: "daily", group: "g", order: 3 }),
    seriesDate: "2026-03-07",
  })

  editor.state.draft.title = "Before"
  editor.askScope.mockImplementation(async () => {
    editor.state.draft.title = "During sheet"
    return "following"
  })
  editor.get.mockImplementation(async () => {
    editor.state.draft.notes = "During fetch"
    return editor.state.event ?? undefined
  })
  await editor.commit()
  await editor.commit()
  expect(editor.askScope).toHaveBeenCalledTimes(1)
  const next = editor.commitEvent.mock.calls[0][1]
  expect(next.title).toBe("During sheet")
  expect(next.notes).toBe("During fetch")
  expect(next.group).toBe("g")
  expect(next.order).toBe(3)
  expect(next.createdAt).toBe(10)
  expect(editor.commitEvent.mock.calls[0][2]).toBe("following")
})

test("an event disappearing during the scope await cancels without fetching or writing", async () => {
  const editor = setup({
    ...eventFixture({ recurrence: "daily" }),
    seriesDate: "2026-03-07",
  })

  editor.state.draft.title = "Edited"
  editor.askScope.mockImplementation(async () => {
    editor.state.event = null
    return "one"
  })
  await editor.commit()
  expect(editor.get).not.toHaveBeenCalled()
  expect(editor.commitEvent).not.toHaveBeenCalled()
  expect(editor.createEvent).not.toHaveBeenCalled()
})

test("an event disappearing during the record await cancels without writing", async () => {
  const editor = setup()
  const stored = editor.state.event

  editor.state.draft.title = "Edited"
  editor.get.mockImplementation(async () => {
    editor.state.event = null
    return stored ?? undefined
  })
  await editor.commit()
  expect(editor.get).toHaveBeenCalledTimes(1)
  expect(editor.commitEvent).not.toHaveBeenCalled()
  expect(editor.createEvent).not.toHaveBeenCalled()
})

test("draft conversion retains overnight dates and multi-day local dates across DST", () => {
  inTimezone("America/New_York", () => {
    expect(
      parseLocal("2026-03-09").getTime() - parseLocal("2026-03-08").getTime(),
    ).toBe(23 * 60 * 60 * 1000)
    const seed = { day: parseLocal("2026-03-07"), span: 2, parent: null }
    const draft = draftFrom(null, seed, null)

    draft.title = "Trip"
    const trip = eventFrom(draft, undefined, 100, () => "trip")
    expect(trip.start).toBe("2026-03-07")
    expect(trip.end).toBe("2026-03-09")
    draft.allDay = false
    draft.days = 0
    draft.start = "23:30"
    draft.end = "01:30"
    const overnight = eventFrom(draft, undefined, 100, () => "overnight")
    expect(overnight.start).toBe("2026-03-07T23:30")
    expect(overnight.end).toBe("2026-03-08T01:30")
    const openEnded = eventFrom(
      { ...draft, hasEnd: false },
      undefined,
      100,
      () => "open",
    )
    expect(openEnded.end).toBe(openEnded.start)
  })
})
