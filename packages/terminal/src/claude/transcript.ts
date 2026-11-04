export type Part =
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; detail: string }

export type Turn = {
  id: string
  role: "user" | "assistant"
  parts: Part[]
}

type Block = {
  type?: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  is_error?: boolean
}

export type ToolResults = Record<string, "done" | "failed">

type Entry = {
  type?: string
  uuid?: string
  isSidechain?: boolean
  isMeta?: boolean
  message?: { content?: string | Block[] }
}

const HIDDEN_TAGS = [
  "command-message",
  "command-args",
  "local-command-stdout",
  "local-command-stderr",
  "local-command-caveat",
  "system-reminder",
]

const DETAIL_KEYS = [
  "description",
  "command",
  "file_path",
  "pattern",
  "path",
  "url",
  "query",
  "prompt",
]

const DETAIL_LIMIT = 120

const between = (text: string, tag: string) => {
  const open = `<${tag}>`
  const start = text.indexOf(open)
  const end = text.indexOf(`</${tag}>`)

  return start === -1 || end === -1
    ? null
    : text.slice(start + open.length, end).trim()
}

const userText = (text: string) => {
  const trimmed = text.trim()
  const command = between(trimmed, "command-name")

  if (command) {
    const args = between(trimmed, "command-args")

    return args ? `${command} ${args}` : command
  }

  return HIDDEN_TAGS.some(tag => trimmed.startsWith(`<${tag}`)) ? null : trimmed
}

const detailOf = (input: Record<string, unknown> = {}) => {
  const key = DETAIL_KEYS.find(name => typeof input[name] === "string")
  const value = key ? String(input[key]).split("\n")[0] : ""

  return value.length > DETAIL_LIMIT
    ? `${value.slice(0, DETAIL_LIMIT)}…`
    : value
}

const userParts = (content: string | Block[]): Part[] => {
  const texts =
    typeof content === "string"
      ? [content]
      : content.filter(b => b.type === "text").map(b => b.text ?? "")

  return texts
    .map(userText)
    .filter((text): text is string => Boolean(text))
    .map(text => ({ kind: "text", text }))
}

const assistantParts = (content: string | Block[]): Part[] => {
  if (typeof content === "string") {
    return content.trim() ? [{ kind: "text", text: content }] : []
  }

  return content.flatMap((block): Part[] => {
    if (block.type === "text" && block.text?.trim()) {
      return [{ kind: "text", text: block.text }]
    }

    if (block.type === "tool_use" && block.name) {
      return [
        {
          kind: "tool",
          id: block.id ?? block.name,
          name: block.name,
          detail: detailOf(block.input),
        },
      ]
    }

    return []
  })
}

const parse = (line: string): Entry | null => {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

const recordResults = (content: string | Block[], results: ToolResults) => {
  if (typeof content === "string") {
    return
  }

  for (const block of content) {
    if (block.type === "tool_result" && block.tool_use_id) {
      results[block.tool_use_id] = block.is_error ? "failed" : "done"
    }
  }
}

export const appendTurns = (
  turns: Turn[],
  results: ToolResults,
  lines: string[],
) => {
  for (const line of lines) {
    const entry = parse(line)
    const content = entry?.message?.content

    if (!entry || entry.isSidechain || entry.isMeta || content === undefined) {
      continue
    }

    if (entry.type === "user") {
      recordResults(content, results)
    }

    if (entry.type !== "user" && entry.type !== "assistant") {
      continue
    }

    const parts =
      entry.type === "user" ? userParts(content) : assistantParts(content)

    if (parts.length === 0) {
      continue
    }

    const last = turns.at(-1)

    if (entry.type === "assistant" && last?.role === "assistant") {
      last.parts.push(...parts)
    } else {
      turns.push({
        id: entry.uuid ?? `${turns.length}`,
        role: entry.type,
        parts,
      })
    }
  }

  return turns
}
