import { windows } from "$lib/server/activity"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
  setHeaders({ "cache-control": "public, max-age=0, s-maxage=3600" })

  return { activity: await windows(fetch) }
}
