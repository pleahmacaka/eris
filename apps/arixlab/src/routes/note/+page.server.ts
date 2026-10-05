import * as m from "$lib/paraglide/messages"
import { latestNote } from "$lib/server/note"
import { SITE_NAME } from "$lib/site"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = ({ fetch, setHeaders }) => {
  setHeaders({ "cache-control": "public, max-age=0, s-maxage=3600" })

  return {
    title: `ArixLab Note | ${SITE_NAME}`,
    description: m.note_tagline(),
    release: latestNote(fetch),
  }
}
