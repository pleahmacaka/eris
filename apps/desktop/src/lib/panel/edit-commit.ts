import type { CalendarEvent, Occurrence, Scope } from "@eris/data"
import { type Draft, draftFrom, eventFrom, isValid, type Seed } from "./draft"
import type { Panel } from "./panel.svelte"

type Editing = {
  event: Occurrence | null
  draft: Draft
  seed: Seed
  reminder: number | null
  creating: boolean
}

// The DOM owns focus/popovers; this workflow owns the session's recurrence scope.
// Reads stay live across awaits, as edits can arrive while the sheet is open.
export const createDraftCommit = (
  read: () => Editing,
  reset: (draft: Draft) => void,
  operations: Pick<Panel, "createEvent" | "commitEvent" | "askScope"> & {
    get: (id: string) => Promise<CalendarEvent | undefined>
    shareNotes: (event: Occurrence, notes: string) => Promise<void>
    newId: () => string
  },
) => {
  let scope: Scope | null = null

  const baseline = () => {
    const { event, seed, reminder } = read()

    return draftFrom(event, seed, reminder)
  }

  const matches = (draft: Draft) =>
    read().event !== null &&
    JSON.stringify(baseline()) === JSON.stringify(draft)

  return async () => {
    const current = read()

    if (!isValid(current.draft) || matches(current.draft)) {
      return
    }

    if (!current.event) {
      if (current.creating) {
        await operations.createEvent(
          eventFrom(current.draft, undefined, Date.now(), operations.newId),
        )
      }

      return
    }

    if (
      current.event.seriesDate &&
      current.event.notesSync &&
      matches({ ...current.draft, notes: current.event.notes })
    ) {
      await operations.shareNotes(current.event, current.draft.notes)

      return
    }

    if (current.event.seriesDate && !scope) {
      scope = await operations.askScope("edit")

      if (!scope) {
        reset(baseline())

        return
      }
    }

    const event = read().event

    if (!event) {
      return
    }

    const stored = await operations.get(event.id)
    const next = read()

    if (!next.event) {
      return
    }

    await operations.commitEvent(
      next.event,
      eventFrom(next.draft, stored, Date.now(), operations.newId),
      scope,
    )
  }
}
