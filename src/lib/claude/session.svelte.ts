import { listen } from "@tauri-apps/api/event"
import * as native from "$lib/native"

export type Block =
  | { kind: "text"; text: string }
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

export type Info = {
  id: string | null
  model: string
  commands: string[]
  cwd: string
}

export type StartOptions = {
  cwd: string | null
  resume: string | null
  plain: boolean
  history: native.TranscriptMessage[]
}

type Event = Record<string, unknown>

const STDERR_TAIL = 6

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

export class ClaudeSession {
  key = crypto.randomUUID()

  turns = $state<Turn[]>([])

  info = $state<Info>({ id: null, model: "", commands: [], cwd: "" })

  permission = $state<Permission | null>(null)

  prompt = $state<Prompt | null>(null)

  busy = $state(false)

  error = $state<string | null>(null)

  cost = $state(0)

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

    await this.write({
      type: "user",
      message: { role: "user", content: [{ type: "text", text }] },
      parent_tool_use_id: null,
      session_id: this.info.id ?? undefined,
    })
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
    }
  }

  private onSystem(event: Event) {
    if (event.subtype !== "init") {
      return
    }

    this.info = {
      id: String(event.session_id ?? ""),
      model: String(event.model ?? ""),
      commands: Array.isArray(event.slash_commands)
        ? event.slash_commands.map(String)
        : [],
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

    for (const part of content) {
      if (part.type !== "tool_result") {
        continue
      }

      for (const turn of this.turns) {
        for (const block of turn.blocks) {
          if (block.kind === "tool" && block.id === part.tool_use_id) {
            block.result = blockText(part.content)
            block.error = part.is_error === true
          }
        }
      }
    }
  }

  private onResult(event: Event) {
    this.busy = false
    this.cost += Number(event.total_cost_usd ?? 0)

    const last = this.lastAssistant()

    if (last) {
      last.streaming = false
    }

    if (event.is_error === true) {
      this.error = String(event.result ?? event.subtype ?? "error")
    }
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
