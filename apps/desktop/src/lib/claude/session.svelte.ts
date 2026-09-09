import { tr } from "@eris/i18n"
import { listen } from "@tauri-apps/api/event"
import * as native from "$lib/native"

export type Usage = Pick<native.ClaudeUsage, "fiveHour" | "sevenDay">

export type Block =
  | { kind: "text"; text: string }
  | { kind: "usage"; usage: Usage }
  | {
      kind: "tool"
      id: string
      name: string
      input: unknown
      result: string | null
      error: boolean
    }

export type Turn = {
  id: string
  role: "user" | "assistant"
  blocks: Block[]
  streaming: boolean
}

export type Permission = {
  requestId: string
  tool: string
  input: Record<string, unknown>
  suggestions: unknown[] | null
}

export type QuestionOption = { label: string; description: string }

export type Question = {
  question: string
  header: string
  options: QuestionOption[]
  multiSelect: boolean
}

export type Prompt = {
  requestId: string
  input: Record<string, unknown>
  questions: Question[]
}

export type Command = { name: string; description: string }

export type Info = {
  id: string | null
  model: string
  commands: Command[]
  cwd: string
}

export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "plan"
  | "auto"
  | "dontAsk"
  | "bypassPermissions"

export type Effort = "" | "low" | "medium" | "high" | "xhigh" | "max"

export type Tri = "default" | "on" | "off"

export type QueueMode = "afterTool" | "afterReply"

export type Queued = {
  id: string
  text: string
  mode: QueueMode
  handed: boolean
}

export type StartOptions = {
  cwd: string | null
  resume: string | null
  plain: boolean
  permissionMode: PermissionMode
  model: string
  effort: Effort
  thinking: Tri
  autoCompact: Tri
  language: string
  budget: number
  systemPrompt: string
  history: native.TranscriptMessage[]
}

type Event = Record<string, unknown>

const STDERR_TAIL = 6
const CONTEXT_WINDOW = 200_000
const CONTEXT_WINDOW_1M = 1_000_000

const blockText = (content: unknown): string => {
  if (typeof content === "string") {
    return content
  }

  if (!Array.isArray(content)) {
    return ""
  }

  return content
    .filter(
      (part): part is { type: string; text: string } => part?.type === "text",
    )
    .map(part => part.text)
    .join("\n")
}

const contextOf = (usage: Event | undefined) =>
  usage
    ? Number(usage.input_tokens ?? 0) +
      Number(usage.cache_creation_input_tokens ?? 0) +
      Number(usage.cache_read_input_tokens ?? 0)
    : 0

export const contextWindowOf = (model: string) =>
  model.endsWith("[1m]") ? CONTEXT_WINDOW_1M : CONTEXT_WINDOW

export class ClaudeSession {
  key = crypto.randomUUID()

  turns = $state<Turn[]>([])

  info = $state<Info>({ id: null, model: "", commands: [], cwd: "" })

  permission = $state<Permission | null>(null)

  prompt = $state<Prompt | null>(null)

  busy = $state(false)

  error = $state<string | null>(null)

  cost = $state(0)

  usage = $state<Usage | null>(null)

  context = $state(0)

  contextWindow = $state(CONTEXT_WINDOW)

  queue = $state<Queued[]>([])

  results = $state(0)

  private stops: Promise<() => void>[] = []

  private stderr: string[] = []

  async start(options: StartOptions) {
    this.turns = options.history.map(message => ({
      id: crypto.randomUUID(),
      role: message.role === "user" ? "user" : "assistant",
      blocks: [{ kind: "text", text: message.text }],
      streaming: false,
    }))
    this.error = null
    this.info = { ...this.info, cwd: options.cwd ?? "" }
    this.contextWindow = contextWindowOf(options.model)

    this.stops = [
      listen<{ key: string; line: string }>("claude-line", e => {
        if (e.payload.key === this.key) {
          this.handle(e.payload.line)
        }
      }),
      listen<{ key: string; line: string }>("claude-stderr", e => {
        if (e.payload.key === this.key) {
          this.stderr = [...this.stderr, e.payload.line].slice(-STDERR_TAIL)
        }
      }),
      listen<{ key: string; code: number | null }>("claude-exit", e => {
        if (e.payload.key === this.key) {
          this.exited(e.payload.code)
        }
      }),
    ]

    await native.claudeStart({
      key: this.key,
      cwd: options.cwd,
      resume: options.resume,
      plain: options.plain,
      permissionMode: options.permissionMode,
      model: options.model,
      effort: options.effort,
      thinking: options.thinking,
      autoCompact: options.autoCompact,
      language: options.language,
      budget: options.budget,
      systemPrompt: options.systemPrompt,
    })

    await this.write({
      type: "control_request",
      request_id: "initialize",
      request: { subtype: "initialize" },
    })
  }

  async send(text: string) {
    this.turns = [
      ...this.turns,
      {
        id: crypto.randomUUID(),
        role: "user",
        blocks: [{ kind: "text", text }],
        streaming: false,
      },
    ]
    this.busy = true
    this.error = null

    await this.deliver(text)
  }

  // the cli injects a message it already holds right after the running tool, so afterTool hands it over at once
  async enqueue(text: string, mode: QueueMode) {
    const item: Queued = { id: crypto.randomUUID(), text, mode, handed: false }

    this.queue = [...this.queue, item]

    if (mode === "afterTool") {
      await this.hand(item.id)
    }
  }

  async setQueueMode(id: string, mode: QueueMode) {
    const item = this.queue.find(q => q.id === id)

    if (!item || item.handed) {
      return
    }

    item.mode = mode

    if (mode === "afterTool") {
      await this.hand(id)
    }
  }

  cancelQueued(id: string) {
    this.queue = this.queue.filter(q => q.id !== id || q.handed)
  }

  async setPermissionMode(mode: PermissionMode) {
    await this.write({
      type: "control_request",
      request_id: crypto.randomUUID(),
      request: { subtype: "set_permission_mode", mode },
    })
  }

  async setModel(model: string) {
    this.contextWindow = contextWindowOf(model)

    await this.write({
      type: "control_request",
      request_id: crypto.randomUUID(),
      request: { subtype: "set_model", model: model || null },
    })
  }

  showUsage(fallback: Usage | null) {
    const usage = this.usage ?? fallback

    this.turns = [
      ...this.turns,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        blocks: usage
          ? [{ kind: "usage", usage }]
          : [{ kind: "text", text: tr("chat.usageUnknown") }],
        streaming: false,
      },
    ]
  }

  async interrupt() {
    await this.write({
      type: "control_request",
      request_id: crypto.randomUUID(),
      request: { subtype: "interrupt" },
    })
  }

  async allow(always: boolean) {
    const pending = this.permission

    if (!pending) {
      return
    }

    this.permission = null

    await this.respond(pending.requestId, {
      behavior: "allow",
      updatedInput: pending.input,
      ...(always && pending.suggestions
        ? { updatedPermissions: pending.suggestions }
        : {}),
    })
  }

  async deny() {
    const pending = this.permission

    if (!pending) {
      return
    }

    this.permission = null

    await this.respond(pending.requestId, {
      behavior: "deny",
      message: "The user declined this action.",
    })
  }

  async answer(answers: Record<string, string>) {
    const pending = this.prompt

    if (!pending) {
      return
    }

    this.prompt = null

    await this.respond(pending.requestId, {
      behavior: "allow",
      updatedInput: { ...pending.input, answers },
    })
  }

  async stop() {
    for (const stop of this.stops) {
      stop.then(off => off()).catch(() => undefined)
    }

    this.stops = []
    await native.claudeStop(this.key).catch(() => undefined)
  }

  private async hand(id: string) {
    const item = this.queue.find(q => q.id === id)

    if (!item || item.handed) {
      return
    }

    item.handed = true
    await this.deliver(item.text)
  }

  private async deliver(text: string) {
    await this.write({
      type: "user",
      message: { role: "user", content: [{ type: "text", text }] },
      parent_tool_use_id: null,
      session_id: this.info.id ?? undefined,
    })
  }

  private consume(item: Queued) {
    this.queue = this.queue.filter(q => q.id !== item.id)
    this.turns = [
      ...this.turns,
      {
        id: crypto.randomUUID(),
        role: "user",
        blocks: [{ kind: "text", text: item.text }],
        streaming: false,
      },
    ]
  }

  private flushHanded() {
    for (const item of this.queue.filter(q => q.handed)) {
      this.consume(item)
    }
  }

  private async respond(requestId: string, response: Record<string, unknown>) {
    await this.write({
      type: "control_response",
      response: { subtype: "success", request_id: requestId, response },
    })
  }

  private async write(payload: Record<string, unknown>) {
    await native.claudeSend(this.key, JSON.stringify(payload)).catch(e => {
      this.error = String(e)
      this.busy = false
    })
  }

  private exited(code: number | null) {
    this.busy = false
    this.queue = []

    if (code !== 0 && code !== null && !this.error) {
      this.error = this.stderr.join("\n") || `claude exited with code ${code}`
    }
  }

  private handle(line: string) {
    let event: Event

    try {
      event = JSON.parse(line)
    } catch {
      return
    }

    switch (event.type) {
      case "system":
        this.onSystem(event)
        break
      case "stream_event":
        this.onStream(event.event as Event)
        break
      case "assistant":
        this.onAssistant(event.message as Event)
        break
      case "user":
        this.onToolResults(event.message as Event)
        break
      case "result":
        this.onResult(event)
        break
      case "control_request":
        this.onControl(event)
        break
      case "control_response":
        this.onInitialized(event.response as Event)
        break
      case "rate_limit_event":
        this.onRateLimit((event.rate_limit_info ?? {}) as Event)
        break
    }
  }

  private onRateLimit(info: Event) {
    const windows = (info.unifiedWindows ?? {}) as Record<
      string,
      Event | undefined
    >
    const window = (name: string) => {
      const found = windows[name]

      if (!found) {
        return null
      }

      const resets = Number(found.resetsAt ?? 0)

      return {
        used: Number(found.utilization ?? 0) * 100,
        resetsAt: resets > 0 ? new Date(resets * 1000).toISOString() : null,
      }
    }

    this.usage = {
      fiveHour: window("five_hour"),
      sevenDay: window("seven_day"),
    }
  }

  private onInitialized(response: Event) {
    if (response.request_id !== "initialize") {
      return
    }

    const inner = (response.response ?? {}) as Event
    const commands = Array.isArray(inner.commands)
      ? (inner.commands as Event[])
      : []

    this.info = {
      ...this.info,
      commands: commands.map(c => ({
        name: String(c.name ?? ""),
        description: String(c.description ?? ""),
      })),
    }
  }

  private onSystem(event: Event) {
    if (event.subtype !== "init") {
      return
    }

    const names = Array.isArray(event.slash_commands)
      ? event.slash_commands.map(String)
      : []

    this.info = {
      id: String(event.session_id ?? ""),
      model: String(event.model ?? ""),
      commands:
        this.info.commands.length > 0
          ? this.info.commands
          : names.map(name => ({ name, description: "" })),
      cwd: String(event.cwd ?? this.info.cwd),
    }
  }

  private assistant(id: string): Turn {
    const found = this.turns.find(turn => turn.id === id)

    if (found) {
      return found
    }

    this.turns = [
      ...this.turns,
      { id, role: "assistant", blocks: [], streaming: true },
    ]

    return this.turns[this.turns.length - 1]
  }

  private lastAssistant(): Turn | null {
    const turn = this.turns.at(-1)

    return turn?.role === "assistant" ? turn : null
  }

  private onStream(event: Event) {
    if (event.type === "message_start") {
      const message = event.message as Event

      this.context =
        contextOf(message.usage as Event | undefined) || this.context
      this.assistant(String(message.id))

      return
    }

    const turn = this.lastAssistant()

    if (!turn) {
      return
    }

    if (event.type === "content_block_start") {
      const block = event.content_block as Event

      if (block.type === "text") {
        turn.blocks.push({ kind: "text", text: String(block.text ?? "") })
      } else if (block.type === "tool_use") {
        turn.blocks.push({
          kind: "tool",
          id: String(block.id),
          name: String(block.name),
          input: block.input ?? {},
          result: null,
          error: false,
        })
      }

      return
    }

    if (event.type === "content_block_delta") {
      const delta = event.delta as Event
      const last = turn.blocks.at(-1)

      if (delta.type === "text_delta" && last?.kind === "text") {
        last.text += String(delta.text ?? "")
      }

      return
    }

    if (event.type === "message_stop") {
      turn.streaming = false
    }
  }

  private onAssistant(message: Event) {
    const turn = this.assistant(String(message.id))
    const content = Array.isArray(message.content)
      ? (message.content as Event[])
      : []
    const results = new Map(
      turn.blocks
        .filter(
          (block): block is Extract<Block, { kind: "tool" }> =>
            block.kind === "tool",
        )
        .map(block => [block.id, block]),
    )

    this.context = contextOf(message.usage as Event | undefined) || this.context

    turn.blocks = content.flatMap((part): Block[] => {
      if (part.type === "text") {
        return [{ kind: "text", text: String(part.text ?? "") }]
      }

      if (part.type === "tool_use") {
        const previous = results.get(String(part.id))

        return [
          {
            kind: "tool",
            id: String(part.id),
            name: String(part.name),
            input: part.input ?? {},
            result: previous?.result ?? null,
            error: previous?.error ?? false,
          },
        ]
      }

      return []
    })
    turn.streaming = false
  }

  private onToolResults(message: Event) {
    const content = Array.isArray(message.content)
      ? (message.content as Event[])
      : []
    let boundary = false

    for (const part of content) {
      if (part.type !== "tool_result") {
        continue
      }

      boundary = true

      for (const turn of this.turns) {
        for (const block of turn.blocks) {
          if (block.kind === "tool" && block.id === part.tool_use_id) {
            block.result = blockText(part.content)
            block.error = part.is_error === true
          }
        }
      }
    }

    if (boundary) {
      this.flushHanded()
    }
  }

  private onResult(event: Event) {
    this.cost += Number(event.total_cost_usd ?? 0)
    this.results += 1

    const models = Object.values(
      (event.modelUsage ?? {}) as Record<string, Event>,
    )
    const window = Math.max(0, ...models.map(m => Number(m.contextWindow ?? 0)))

    if (window > 0) {
      this.contextWindow = window
    }

    const last = this.lastAssistant()

    if (last) {
      last.streaming = false
    }

    if (event.is_error === true) {
      this.error = String(event.result ?? event.subtype ?? "error")
    }

    if (this.queue.some(q => q.handed)) {
      this.flushHanded()

      return
    }

    const next = this.queue[0]

    if (next) {
      this.consume(next)
      this.deliver(next.text)

      return
    }

    this.busy = false
  }

  private onControl(event: Event) {
    const request = event.request as Event
    const requestId = String(event.request_id)

    if (request.subtype !== "can_use_tool") {
      this.write({
        type: "control_response",
        response: {
          subtype: "error",
          request_id: requestId,
          error: "unsupported",
        },
      })

      return
    }

    const input = (request.input ?? {}) as Record<string, unknown>

    if (request.tool_name === "AskUserQuestion") {
      const questions = Array.isArray(input.questions)
        ? (input.questions as Event[])
        : []

      this.prompt = {
        requestId,
        input,
        questions: questions.map(q => ({
          question: String(q.question ?? ""),
          header: String(q.header ?? ""),
          multiSelect: q.multiSelect === true,
          options: Array.isArray(q.options)
            ? (q.options as Event[]).map(o => ({
                label: String(o.label ?? ""),
                description: String(o.description ?? ""),
              }))
            : [],
        })),
      }

      return
    }

    this.permission = {
      requestId,
      tool: String(request.tool_name ?? ""),
      input,
      suggestions: Array.isArray(request.permission_suggestions)
        ? (request.permission_suggestions as unknown[])
        : null,
    }
  }
}
