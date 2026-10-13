import { setupI18n } from "@eris/i18n"

export const ssr = false
export const prerender = true

export const load = () => setupI18n("system")
