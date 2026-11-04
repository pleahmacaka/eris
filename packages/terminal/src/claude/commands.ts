import type { ClaudeCommand } from "../pty"

const BUILT_IN = [
  "add-dir",
  "agents",
  "clear",
  "compact",
  "config",
  "context",
  "cost",
  "doctor",
  "exit",
  "export",
  "help",
  "hooks",
  "init",
  "mcp",
  "memory",
  "model",
  "permissions",
  "plugin",
  "resume",
  "review",
  "rewind",
  "status",
  "usage",
]

const LIMIT = 8

export const withBuiltIns = (custom: ClaudeCommand[]) => {
  const named = new Set(custom.map(entry => entry.name))
  const builtIns = BUILT_IN.filter(name => !named.has(name)).map(name => ({
    name,
    description: "",
  }))

  return [...builtIns, ...custom].sort((a, b) => a.name.localeCompare(b.name))
}

export const matchCommands = (all: ClaudeCommand[], draft: string) => {
  if (!draft.startsWith("/") || draft.includes(" ") || draft.includes("\n")) {
    return []
  }

  const query = draft.slice(1).toLowerCase()
  const starts = all.filter(entry => entry.name.toLowerCase().startsWith(query))
  const contains = all.filter(
    entry =>
      !entry.name.toLowerCase().startsWith(query) &&
      entry.name.toLowerCase().includes(query),
  )

  return [...starts, ...contains].slice(0, LIMIT)
}
