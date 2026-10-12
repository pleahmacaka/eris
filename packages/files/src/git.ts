import type { Item } from "./items"
import { pathKey } from "./locations"
import type { GitChange, GitStatus } from "./native"

export type GitState =
  | "ignored"
  | "untracked"
  | "staged"
  | "modified"
  | "conflict"

export type ChangeGroup = {
  id: "staged" | "changes" | "untracked"
  tone: GitState
  rows: { path: string; letter: string }[]
}

const RANK: GitState[] = [
  "ignored",
  "untracked",
  "staged",
  "modified",
  "conflict",
]

const UNTRACKED_OR_CLEAN = [" ", "?", "!"]

const stronger = (current: GitState | undefined, next: GitState) =>
  current && RANK.indexOf(current) >= RANK.indexOf(next) ? current : next

export const stateOf = ({ code }: GitChange): GitState => {
  if (code === "!!") {
    return "ignored"
  }

  if (code === "??") {
    return "untracked"
  }

  if (code.includes("U") || code === "AA" || code === "DD") {
    return "conflict"
  }

  return code[1] === " " ? "staged" : "modified"
}

const tracked = (letter: string) =>
  UNTRACKED_OR_CLEAN.includes(letter) ? null : letter

export const changeGroups = (status: GitStatus): ChangeGroup[] => {
  const rows = (letterOf: (code: string) => string | null) =>
    status.changes.flatMap(({ code, path }) => {
      const letter = letterOf(code)

      return letter ? [{ path, letter }] : []
    })

  return [
    { id: "staged", tone: "staged", rows: rows(code => tracked(code[0])) },
    { id: "changes", tone: "modified", rows: rows(code => tracked(code[1])) },
    {
      id: "untracked",
      tone: "untracked",
      rows: rows(code => (code === "??" ? "U" : null)),
    },
  ]
}

export const gitStates = (status: GitStatus, items: Item[]) => {
  const states = new Map<string, GitState>()
  const prefix = pathKey(status.prefix)
  const byName = new Map(items.map(item => [pathKey(item.name), item.key]))

  const mark = (key: string, state: GitState) => {
    states.set(key, stronger(states.get(key), state))
  }

  for (const change of status.changes) {
    const state = stateOf(change)
    const path = pathKey(change.path)

    if (path.endsWith("/") && prefix.startsWith(path)) {
      for (const item of items) {
        mark(item.key, state)
      }

      continue
    }

    if (!path.startsWith(prefix)) {
      continue
    }

    const [name, ...below] = path.slice(prefix.length).split("/")
    const nested = below.some(Boolean)
    const key = byName.get(name)

    if (key && !(nested && state === "ignored")) {
      mark(key, state)
    }
  }

  return states
}
