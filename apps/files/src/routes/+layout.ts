import { registerFilesMessages } from "@eris/files"
import { setupI18n } from "@eris/i18n"

export const ssr = false
export const prerender = true

setupI18n("system")
registerFilesMessages()
