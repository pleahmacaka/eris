import { github, tokscale } from "$lib/server/activity"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
  setHeaders({ "cache-control": "public, max-age=0, s-maxage=3600" })

  const [githubFeed, tokscaleFeed] = await Promise.all([
    github(fetch).catch(() => null),
    tokscale(fetch).catch(() => null),
  ])

  return { githubFeed, tokscaleFeed }
}
