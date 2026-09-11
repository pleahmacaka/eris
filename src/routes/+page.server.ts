import { windows } from "$lib/server/activity"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = ({ fetch, setHeaders }) => {
  setHeaders({ "cache-control": "public, max-age=0, s-maxage=3600" })

  return { activity: windows(fetch) }
}
