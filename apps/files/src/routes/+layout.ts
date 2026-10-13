import { registerFilesMessages } from "@eris/files"
import { setupI18n } from "@eris/i18n"

export const ssr = false
export const prerender = true

registerFilesMessages()

export const load = () => setupI18n("system")
