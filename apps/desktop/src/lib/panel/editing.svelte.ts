import { untrack } from "svelte"
import { events, newId, shareOccurrenceNotes } from "#lib/data/index.js"
import { type Draft, draftFrom, type Seed } from "./draft"
import { createDraftCommit } from "./edit-commit"
import type { Panel } from "./panel.svelte"

export type Field = "date" | "repeat" | "reminder" | "tags" | "task" | "add"

export const editingState = (panel: Panel) => {
  const event = $derived(panel.openEvent)
  const view = $derived(panel.view)
  const seed = $derived<Seed>(
    view.kind === "new" ? view : { day: panel.selected, span: 0, parent: null },
  )
  const reminderDefault = () => panel.profile.calendar.reminderMinutes || null
  const keepKey = untrack(() =>
    view.kind === "event" ? `${view.id}@${view.date}` : "new",
  )
  let draft = $state<Draft>(
    untrack(() =>
      panel.kept?.key === keepKey
        ? panel.kept.draft
        : draftFrom(event, seed, reminderDefault()),
    ),
  )
  let seenStamp = untrack(() => event?.updatedAt)
  let open = $state<Field | null>(null)
  let writingNotes = $state(false)

  $effect(() => {
    const current = event

    if (current?.updatedAt === seenStamp) {
      return
    }

    seenStamp = current?.updatedAt

    untrack(() => {
      if (
        current &&
        open === null &&
        !writingNotes &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        draft = draftFrom(current, seed, reminderDefault())
      }
    })
  })

  $effect(() => {
    panel.kept = { key: keepKey, draft: $state.snapshot(draft) }
  })

  $effect(() => {
    if (panel.asking) {
      untrack(() => {
        open = null
      })
    }
  })

  const commit = createDraftCommit(
    () => ({
      event,
      draft,
      seed,
      reminder: reminderDefault(),
      creating: view.kind === "new",
    }),
    next => {
      draft = next
    },
    {
      createEvent: panel.createEvent,
      commitEvent: panel.commitEvent,
      askScope: panel.askScope,
      get: id => events.get(id),
      shareNotes: shareOccurrenceNotes,
      newId,
    },
  )

  const change = (next: Partial<Draft>) => {
    draft = { ...draft, ...next }
    commit()
  }

  return {
    get draft() {
      return draft
    },
    get open() {
      return open
    },
    set open(next: Field | null) {
      open = next
    },
    get writingNotes() {
      return writingNotes
    },
    set writingNotes(next: boolean) {
      writingNotes = next
    },
    commit,
    change,
    toggle: (field: Field) => {
      open = open === field ? null : field
    },
    addField: (field: Field) => {
      if (field === "task") {
        change({ task: true })
        open = null

        return
      }

      if (field === "reminder") {
        draft = { ...draft, reminder: reminderDefault() ?? 10 }
        commit()
      }

      open = field
    },
  }
}

export type EditingState = ReturnType<typeof editingState>
