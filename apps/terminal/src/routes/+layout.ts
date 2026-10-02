import { setupI18n } from "@eris/i18n"
import { registerTerminalMessages } from "@eris/terminal"

export const ssr = false
export const prerender = true

setupI18n("system")
registerTerminalMessages()
