import type { Series, Window } from "$lib/server/activity"

export type Cell = {
  date: string
  github: number
  tokscale: number
}

const DAY = 86_400_000

const expand = (series: Series) => {
  const start = Date.parse(`${series.start}T00:00:00Z`)

  return [...series.levels].map((level, i) => ({
    date: new Date(start + i * DAY).toISOString().slice(0, 10),
    level: Number(level),
  }))
}

export function cells(window: Window): (Cell | null)[] {
  const github = expand(window.github)
  const tokscale = window.tokscale ? expand(window.tokscale) : []
  const byDate = new Map(tokscale.map(day => [day.date, day.level]))

  const lead = new Date(`${github[0].date}T00:00:00Z`).getUTCDay()

  return [
    ...Array.from({ length: lead }, () => null),
    ...github.map(day => ({
      date: day.date,
      github: day.level,
      tokscale: byDate.get(day.date) ?? 0,
    })),
  ]
}
