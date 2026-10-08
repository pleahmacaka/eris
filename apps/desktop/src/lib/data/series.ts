import {
  type CalendarEvent,
  editInSeries,
  type Occurrence,
  removeFromSeries,
  type Scope,
  shareNotes,
} from "@eris/data"
import { events } from "./store"

const seriesOf = async (occurrence: Occurrence) =>
  occurrence.seriesDate ? await events.get(occurrence.id) : undefined

export const removeOccurrence = async (
  occurrence: Occurrence,
  scope: Scope,
) => {
  const series = await seriesOf(occurrence)

  if (!series || !occurrence.seriesDate) {
    return
  }

  await events.apply(
    removeFromSeries(
      series,
      occurrence.seriesDate,
      scope,
      await events.all(),
      Date.now(),
    ),
  )
}

export const shareOccurrenceNotes = async (
  occurrence: Occurrence,
  notes: string,
) => {
  const series = await seriesOf(occurrence)

  if (series) {
    await events.apply(
      shareNotes(series, notes, await events.all(), Date.now()),
    )
  }
}

export const setNotesSync = async (occurrence: Occurrence, on: boolean) => {
  const series = await seriesOf(occurrence)

  if (series) {
    await events.put({ ...series, notesSync: on, updatedAt: Date.now() })
  }
}

export const editOccurrence = async (
  occurrence: Occurrence,
  draft: CalendarEvent,
  scope: Scope,
) => {
  const series = await seriesOf(occurrence)

  if (!series) {
    return null
  }

  const change = editInSeries(
    series,
    occurrence,
    draft,
    scope,
    await events.all(),
    Date.now(),
  )

  await events.apply(change)

  return change.edited
}
