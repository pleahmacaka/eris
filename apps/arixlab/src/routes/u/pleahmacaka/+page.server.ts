import { OPERATOR } from "$lib/data/nodes"
import { windows } from "$lib/server/activity"
import { SITE_NAME } from "$lib/site"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = ({ fetch, setHeaders }) => {
  setHeaders({ "cache-control": "public, max-age=0, s-maxage=3600" })

  return {
    title: `${OPERATOR.handle} | ${SITE_NAME}`,
    activity: windows(fetch),
  }
}
