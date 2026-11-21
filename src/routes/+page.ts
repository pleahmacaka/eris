import { redirect } from "@sveltejs/kit"
import { loadSession } from "#lib/matrix/session.js"
import { HOME_PATH, LOGIN_PATH } from "#lib/routes.js"

export const load = () => {
  redirect(307, loadSession(localStorage) ? HOME_PATH : LOGIN_PATH)
}
