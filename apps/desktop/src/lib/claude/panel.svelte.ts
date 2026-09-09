import {
  type ChatPermission,
  type DeviceSettings,
  saveDevice,
} from "@eris/settings"
import { tick } from "svelte"
import type * as native from "$lib/native"
import { Bubbles } from "./bubbles.svelte"
import type { Command, Question } from "./session.svelte"
import { folderNameOf, relative } from "./text"

const LOCAL_NAMES = ["clear", "resume", "usage", "model", "effort", "config"]

export class Panel extends Bubbles {
  recent = $state<string[]>(this.stored.recent ?? [])

  cli = $state<string | null | undefined>(undefined)

  history = $state<native.Transcript[]>([])

  historyOpen = $state(false)

  configOpen = $state(false)

  editingTitle = $state(false)

  titleDraft = $state("")

  titleInput = $state<HTMLInputElement>()

  draft = $state("")

  input = $state<HTMLTextAreaElement>()

  mentions = $state<native.FileEntry[]>([])

  picked = $state<Record<string, string[]>>({})

  cwd = $derived(this.current?.folder || null)

  folderName = $derived(folderNameOf(this.current?.folder ?? ""))

  contextPercent = $derived(
    this.session && this.session.contextWindow > 0
      ? Math.min(
          100,
          Math.round((this.session.context / this.session.contextWindow) * 100),
        )
      : 0,
  )

  LOCAL = $derived<Command[]>(
    LOCAL_NAMES.map(name => ({
      name,
      description: this.text.current(`chat.commands.${name}`),
    })),
  )

  slashTerm = $derived(
    this.draft.startsWith("/") && !this.draft.includes(" ")
      ? this.draft.slice(1)
      : null,
  )

  commands = $derived.by(() => {
    const term = this.slashTerm

    if (term === null) {
      return []
    }

    return [
      ...this.LOCAL,
      ...(this.session?.info.commands ?? []).filter(
        command => !this.LOCAL.some(local => local.name === command.name),
      ),
    ]
      .filter(command => command.name.startsWith(term))
      .sort((a, b) => Number(b.name === term) - Number(a.name === term))
      .slice(0, 8)
  })

  mentionTerm = $derived.by(() => {
    const at = this.draft.lastIndexOf("@")

    if (at < 0) {
      return null
    }

    const before = at === 0 ? " " : this.draft[at - 1]
    const term = this.draft.slice(at + 1)

    return (before === " " || before === "\n") && !term.includes(" ")
      ? term
      : null
  })

  patchDevice<K extends keyof DeviceSettings>(
    key: K,
    value: DeviceSettings[K],
  ) {
    this.device = { ...this.device, [key]: value }
    saveDevice($state.snapshot(this.device)).catch(() => undefined)
  }

  async update(patch: Partial<DeviceSettings>) {
    this.device = { ...this.device, ...patch }
    await saveDevice($state.snapshot(this.device)).catch(() => undefined)
  }

  async setPermission(mode: ChatPermission) {
    await this.update({ chatPermission: mode })
    await this.session?.setPermissionMode(mode)
  }

  async setModel(model: string) {
    await this.update({ chatModel: model.trim() })
    await this.session?.setModel(model.trim())
  }

  relative(path: string) {
    return relative(this.cwd ?? "", path)
  }

  completeCommand(command: string) {
    this.draft = `/${command} `
    this.input?.focus()
  }

  completeMention(entry: native.FileEntry) {
    const at = this.draft.lastIndexOf("@")

    this.draft = `${this.draft.slice(0, at)}@${this.relative(entry.path).replaceAll("\\", "/")} `
    this.mentions = []
    this.input?.focus()
  }

  pick(question: Question, label: string) {
    const current = this.picked[question.question] ?? []

    this.picked = {
      ...this.picked,
      [question.question]: question.multiSelect
        ? current.includes(label)
          ? current.filter(item => item !== label)
          : [...current, label]
        : [label],
    }
  }

  submitAnswers() {
    const session = this.session

    if (!session?.prompt) {
      return
    }

    const answers = Object.fromEntries(
      session.prompt.questions.map(question => [
        question.question,
        (this.picked[question.question] ?? []).join(", "),
      ]),
    )

    this.picked = {}
    session.answer(answers)
  }

  startRename() {
    if (!this.current) {
      return
    }

    this.titleDraft = this.titleOf(this.current)
    this.editingTitle = true
    tick().then(() => this.titleInput?.select())
  }

  commitRename() {
    if (this.current && this.editingTitle) {
      this.current.title = this.titleDraft.trim()
    }

    this.editingTitle = false
  }
}
