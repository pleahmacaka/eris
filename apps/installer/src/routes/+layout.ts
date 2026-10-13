import { setupI18n } from "@eris/i18n"
import { registerInstallerMessages } from "#lib/i18n/index.js"

export const ssr = false
export const prerender = true

registerInstallerMessages()

export const load = () => setupI18n("system")
