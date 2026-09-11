export type Day = { date: string; level: number }

export type Feed = {
  days: Day[]
  stat: string
  href: string
}

const USER = "pleahmacaka"

const GITHUB_ENDPOINT = `https://github-contributions-api.jogruber.de/v4/${USER}?y=last`

const TOKSCALE_ENDPOINT = `https://tokscale.ai/api/embed/${USER}/svg?template=graph&theme=light`

const TOKSCALE_CELL = /<title>(\d{4}-\d{2}-\d{2}) · level (\d)<\/title>/g

type Fetch = typeof globalThis.fetch

export async function github(fetch: Fetch): Promise<Feed | null> {
  const res = await fetch(GITHUB_ENDPOINT)

  if (!res.ok) {
    return null
  }

  const body = (await res.json()) as {
    total: { lastYear: number }
    contributions: Day[]
  }

  return {
    days: body.contributions.map(({ date, level }) => ({ date, level })),
    stat: `${body.total.lastYear.toLocaleString("en")} contributions`,
    href: `https://github.com/${USER}`,
  }
}

export async function tokscale(fetch: Fetch): Promise<Feed | null> {
  const res = await fetch(TOKSCALE_ENDPOINT)

  if (!res.ok) {
    return null
  }

  const days = [...(await res.text()).matchAll(TOKSCALE_CELL)].map(
    ([, date, level]) => ({ date, level: Number(level) }),
  )

  if (days.length === 0) {
    return null
  }

  const active = days.filter(day => day.level > 0).length

  return {
    days,
    stat: `${active.toLocaleString("en")} active days`,
    href: `https://tokscale.ai/u/${USER}`,
  }
}
