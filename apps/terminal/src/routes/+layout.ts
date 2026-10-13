import { setupI18n } from "@eris/i18n"
import { registerTerminalMessages } from "@eris/terminal"

export const ssr = false
export const prerender = true

registerTerminalMessages()

export const load = () => setupI18n("system")
