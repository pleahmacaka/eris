export type Series = {
  start: string
  levels: string
}

export type Window = {
  key: string
  githubTotal: number
  github: Series
  tokscale: Series | null
  tokscaleActive: number | null
}

type Day = { date: string; count: number; level: number }

const USER = "pleahmacaka"

const GITHUB_ENDPOINT = `https://github-contributions-api.jogruber.de/v4/${USER}`

const TOKSCALE_ENDPOINT = `https://tokscale.ai/api/embed/${USER}/svg?template=graph&theme=light`

const TOKSCALE_CELL = /<title>(\d{4}-\d{2}-\d{2}) · level (\d)<\/title>/g

type Fetch = typeof globalThis.fetch

const pack = (days: Day[]): Series => ({
  start: days[0].date,
  levels: days.map(day => day.level).join(""),
})

async function github(fetch: Fetch) {
  const res = await fetch(GITHUB_ENDPOINT)

  if (!res.ok) {
    return null
  }

  const body = (await res.json()) as {
    total: Record<string, number>
    contributions: Day[]
  }

  return {
    total: body.total,
    contributions: [...body.contributions].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  }
}

async function tokscale(fetch: Fetch) {
  const res = await fetch(TOKSCALE_ENDPOINT)

  if (!res.ok) {
    return null
  }

  const days = [...(await res.text()).matchAll(TOKSCALE_CELL)].map(
    ([, date, level]) => ({ date, count: 0, level: Number(level) }),
  )

  return days.length > 0 ? days : null
}

export async function windows(fetch: Fetch): Promise<Window[]> {
  const [gh, ts] = await Promise.all([
    github(fetch).catch(() => null),
    tokscale(fetch).catch(() => null),
  ])

  if (!gh) {
    return []
  }

  const out: Window[] = []

  if (ts) {
    const from = ts[0].date
    const to = ts[ts.length - 1].date
    const span = gh.contributions.filter(
      day => day.date >= from && day.date <= to,
    )

    out.push({
      key: "rolling",
      githubTotal: span.reduce((sum, day) => sum + day.count, 0),
      github: pack(span),
      tokscale: pack(ts),
      tokscaleActive: ts.filter(day => day.level > 0).length,
    })
  }

  const years = Object.entries(gh.total).sort(([a], [b]) => b.localeCompare(a))

  for (const [year, total] of years) {
    const span = gh.contributions.filter(day => day.date.startsWith(year))

    if (span.length === 0 || total === 0) {
      continue
    }

    out.push({
      key: year,
      githubTotal: total,
      github: pack(span),
      tokscale: null,
      tokscaleActive: null,
    })
  }

  return out
}
