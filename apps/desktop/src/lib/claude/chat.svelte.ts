import type {
  ChatEffort,
  ChatPermission,
  ChatTri,
  DeviceSettings,
} from "@eris/settings"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { open as pickDirectory } from "@tauri-apps/plugin-dialog"
import { tick } from "svelte"
import * as native from "$lib/native"
import { type Bubble, STORAGE } from "./bubbles.svelte"
import { Panel } from "./panel.svelte"
import { ClaudeSession } from "./session.svelte"

export const MODELS = [
  "fable",
  "opus",
  "sonnet",
  "haiku",
  "opus[1m]",
  "sonnet[1m]",
]

export const EFFORTS: ChatEffort[] = [
  "",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]

export const PERMISSIONS: ChatPermission[] = [
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
]

export const TRIS: ChatTri[] = ["default", "on", "off"]

const RECENT_LIMIT = 8

const startKey = (d: DeviceSettings) =>
  JSON.stringify([
    d.chatEffort,
    d.chatThinking,
    d.chatAutoCompact,
    d.chatLanguage,
    d.chatBudget,
    d.chatSystemPrompt,
  ])

export class Chat extends Panel {
  private readonly appWindow = getCurrentWindow()

  stale = $derived(
    this.current !== null &&
      this.current.session !== null &&
      this.current.started !== startKey(this.device),
  )

  remember() {
    const folder = this.current?.folder ?? this.bubbles[0]?.folder ?? ""

    if (folder && !this.recent.includes(folder)) {
      this.recent = [folder, ...this.recent].slice(0, RECENT_LIMIT)
    }

    localStorage.setItem(
      STORAGE,
      JSON.stringify({ folder, recent: this.recent }),
    )
  }

  async fresh(b: Bubble, resume: string | null = null) {
    await b.session?.stop()

    const next = new ClaudeSession()

    b.session = next
    b.started = startKey(this.device)
    this.historyOpen = false
    this.configOpen = false
    this.picked = {}

    const folder = b.folder || null
    const past = resume
      ? await native.claudeTranscript(folder, resume).catch(() => [])
      : []

    await next
      .start({
        cwd: folder,
        resume,
        plain: !b.folder,
        permissionMode: this.device.chatPermission,
        model: this.device.chatModel,
        effort: this.device.chatEffort,
        thinking: this.device.chatThinking,
        autoCompact: this.device.chatAutoCompact,
        language: this.device.chatLanguage,
        budget: this.device.chatBudget,
        systemPrompt: this.device.chatSystemPrompt,
        history: past,
      })
      .catch(e => {
        next.error = String(e)
      })
  }

  async restart() {
    if (this.current) {
      await this.fresh(this.current, this.current.session?.info.id || null)
    }
  }

  async loadHistory() {
    this.history = await native.claudeSessions(this.cwd).catch(() => [])
    this.historyOpen = true
    this.configOpen = false
  }

  async chooseFolder() {
    if (!this.current) {
      return
    }

    const choice = await pickDirectory({
      directory: true,
      defaultPath: this.current.folder || undefined,
    }).catch(() => null)

    if (typeof choice !== "string") {
      return
    }

    this.current.folder = choice
    this.remember()
    await this.fresh(this.current)
  }

  async useFolder(path: string) {
    if (!this.current) {
      return
    }

    this.current.folder = path
    this.remember()
    await this.fresh(this.current)
  }

  async closeFolder() {
    if (!this.current) {
      return
    }

    this.current.folder = ""
    this.remember()
    await this.fresh(this.current)
  }

  async showUsage() {
    if (!this.current) {
      return
    }

    if (!this.current.session) {
      await this.fresh(this.current)
    }

    const fallback = this.current.session?.usage
      ? null
      : await native.claudeUsage(null).catch(() => null)

    this.current.session?.showUsage(fallback)
  }

  async runLocal(text: string) {
    const name = text.slice(1).split(" ")[0]

    if (name === "clear") {
      if (this.current) {
        await this.fresh(this.current)
      }
    } else if (name === "resume") {
      await this.loadHistory()
    } else if (name === "usage") {
      await this.showUsage()
    } else if (name === "model" || name === "effort" || name === "config") {
      this.configOpen = true
      this.historyOpen = false
    } else {
      return false
    }

    return true
  }

  async send() {
    const text = this.draft.trim()

    if (!text || !this.current) {
      return
    }

    this.draft = ""

    if (text.startsWith("/") && (await this.runLocal(text))) {
      return
    }

    if (!this.current.session) {
      await this.fresh(this.current)
    }

    const s = this.current.session

    if (!s) {
      return
    }

    if (s.busy) {
      await s.enqueue(text, this.device.chatQueueMode)
    } else {
      await s.send(text)
    }
  }

  openPanel(id: string) {
    const b = this.bubbles.find(x => x.id === id)

    if (!b) {
      return
    }

    this.openId = id
    this.lastId = id
    b.unread = false
    this.historyOpen = false
    this.configOpen = false
    this.editingTitle = false
    this.appWindow.setFocus().catch(() => undefined)
    tick().then(() => this.input?.focus())

    if (!b.session && this.cli !== null) {
      this.fresh(b)
    }
  }

  closePanel() {
    this.openId = null
    this.editingTitle = false
  }

  toggle(id?: string) {
    const target = id ?? this.lastId ?? this.bubbles[0]?.id

    if (!target) {
      return
    }

    if (this.openId === target) {
      this.closePanel()
    } else {
      this.openPanel(target)
    }
  }

  hide() {
    this.closePanel()
    native.hideWindow("chat").catch(() => undefined)
  }

  escape() {
    if (this.editingTitle) {
      this.editingTitle = false

      return
    }

    if (
      this.historyOpen ||
      this.configOpen ||
      this.commands.length > 0 ||
      this.mentions.length > 0
    ) {
      this.historyOpen = false
      this.configOpen = false
      this.mentions = []
      this.draft = this.commands.length > 0 ? "" : this.draft

      return
    }

    this.closePanel()
  }
}
