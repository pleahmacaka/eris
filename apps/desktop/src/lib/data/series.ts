import {
  type CalendarEvent,
  editInSeries,
  type Occurrence,
  removeFromSeries,
  type Scope,
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
