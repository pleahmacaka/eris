import { tr } from "@eris/i18n"
import { toast } from "@eris/ui"

export type CommandErrors = {
  fail: (reason: unknown) => void
  failed: (reason: unknown) => null
}

export const fail = (reason: unknown) => {
  const text = String(reason)
  const key = `explorer.errors.${text}`
  const message = tr(key)

  if (text !== "cancelled") {
    toast(message === key ? text : message, "error")
  }
}

export const failed = (reason: unknown) => {
  fail(reason)

  return null
}
