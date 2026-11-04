import {
  type ClaudeChat,
  type ClaudeCommand,
  claudeChat,
  claudeCommands,
  claudeTranscript,
} from "../pty"
import { withBuiltIns } from "./commands"
import { parseScreen, type Screen } from "./screen"
import { appendTurns, type ToolResults, type Turn } from "./transcript"

const TICK_MS = 500
const SESSION_EVERY = 4

export class ClaudeWatch {
  chat = $state<ClaudeChat | null>(null)

  turns = $state<Turn[]>([])

  results = $state<ToolResults>({})

  screen = $state<Screen>({ busy: false, prompt: null, overlay: false })

  commands = $state<ClaudeCommand[]>(withBuiltIns([]))

  private overlaySeen = false

  private offset = 0

  private ticks = 0

  private busy = false

  constructor(private pty: number) {}

  see(text: string) {
    const next = parseScreen(text)
    const steady = next.overlay && this.overlaySeen

    this.overlaySeen = next.overlay
    this.screen = { ...next, overlay: steady }
  }

  start() {
    const timer = setInterval(() => this.tick(), TICK_MS)

    this.tick()

    return () => clearInterval(timer)
  }

  private async tick() {
    if (this.busy) {
      return
    }

    this.busy = true

    try {
      if (!this.chat || this.ticks % SESSION_EVERY === 0) {
        await this.findSession()
      }

      if (this.chat) {
        await this.read(this.chat)
      }
    } finally {
      this.ticks += 1
      this.busy = false
    }
  }

  private async findSession() {
    const found = await claudeChat(this.pty).catch(() => null)

    if (found?.transcript === this.chat?.transcript) {
      return
    }

    this.chat = found
    this.turns = []
    this.results = {}
    this.offset = 0

    if (found) {
      const custom = await claudeCommands(found.cwd).catch(() => [])

      this.commands = withBuiltIns(custom)
    }
  }

  private async read(chat: ClaudeChat) {
    const chunk = await claudeTranscript(chat.transcript, this.offset).catch(
      () => null,
    )

    if (!chunk || chat !== this.chat) {
      return
    }

    if (chunk.next < this.offset) {
      this.turns = []
      this.results = {}
    }

    this.offset = chunk.next

    if (chunk.lines.length > 0) {
      appendTurns(this.turns, this.results, chunk.lines)
    }
  }
}
