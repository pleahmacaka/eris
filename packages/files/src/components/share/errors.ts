import { tr } from "@eris/i18n"

const PROBLEMS = [
  "empty",
  "unsupported",
  "unreachable",
  "denied",
  "invalid",
  "self",
  "revoked",
  "blocked",
  "missing",
  "busy",
  "pending",
  "unpaired",
  "notReady",
] as const

export type Problem = (typeof PROBLEMS)[number]

const isProblem = (code: string): code is Problem =>
  (PROBLEMS as readonly string[]).includes(code)

export const shareError = (reason: unknown) => {
  const code = String(reason)

  return tr(`share.errors.${isProblem(code) ? code : "failed"}`)
}
