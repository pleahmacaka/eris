<script lang="ts">
  import Icon from "@iconify/svelte"
  import { listen } from "@tauri-apps/api/event"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { open as pickDirectory } from "@tauri-apps/plugin-dialog"
  import { tick, untrack } from "svelte"
  import { cubicOut } from "svelte/easing"
  import { scale } from "svelte/transition"
  import { t } from "svelte-i18n"
  import { claudeIcon } from "$lib/claude-icon"
  import { editing, watchEdit } from "$lib/edit/edit.svelte"
  import { Segmented } from "@eris/ui"
  import Markdown from "$lib/claude/Markdown.svelte"
  import {
    ClaudeSession,
    type Command,
    type Question,
  } from "$lib/claude/session.svelte"
  import { ensureDevice } from "$lib/device"
  import { currentLocale } from "@eris/i18n"
  import * as native from "$lib/native"
  import {
    type ChatEffort,
    type ChatPermission,
    type ChatTri,
    type DeviceSettings,
    defaultDevice,
    onDevice,
    saveDevice,
  } from "@eris/settings"

  type Bubble = {
    id: string
    hue: number
    stack: string
    left: number
    top: number
    corner: { right: boolean; bottom: boolean }
    folder: string
    session: ClaudeSession | null
    unread: boolean
    title: string
    seen: number
    started: string
  }

  type Mood = "idle" | "busy" | "attention" | "unread" | "other"

  const MENTION_DELAY = 150
  const RECENT_LIMIT = 8
  const STORAGE = "eris.chat"
  const TITLE_LIMIT = 40
  const PREVIEW_LIMIT = 100
  const SLIDE = 260
  const HUES = [25, 75, 145, 200, 255, 300, 340]
  const MODELS = ["fable", "opus", "sonnet", "haiku", "opus[1m]", "sonnet[1m]"]
  const EFFORTS: ChatEffort[] = ["", "low", "medium", "high", "xhigh", "max"]
  const PERMISSIONS: ChatPermission[] = [
    "default",
    "acceptEdits",
    "plan",
    "auto",
    "dontAsk",
    "bypassPermissions",
  ]
  const TRIS: ChatTri[] = ["default", "on", "off"]

  const LOCAL_NAMES = ["clear", "resume", "usage", "model", "effort", "config"]

  const appWindow = getCurrentWindow()

  const stored = JSON.parse(localStorage.getItem(STORAGE) ?? "{}") as {
    folder?: string
    recent?: string[]
  }

  let area = $state<native.ChatArea>({ width: 0, height: 0, monitors: [], home: 0 })
  let device = $state<DeviceSettings>(structuredClone(defaultDevice))
  let previewing = $state<number | null>(null)

  const EDIT_SPOT = "bubble"

  const patchDevice = <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => {
    device = { ...device, [key]: value }
    saveDevice($state.snapshot(device)).catch(() => undefined)
  }

  const hoverOptions = $derived([
    { value: "none" as const, label: $t("chat.hover.none") },
    { value: "title" as const, label: $t("chat.hover.title") },
    { value: "preview" as const, label: $t("chat.hover.preview") },
  ])
  let bubbles = $state<Bubble[]>([])
  let openId = $state<string | null>(null)
  let lastId = $state<string | null>(null)
  let hoverId = $state<string | null>(null)
  let dragId = $state<string | null>(null)
  let moved = $state(false)
  let slide = $state<number[] | null>(null)
  let recent = $state<string[]>(stored.recent ?? [])
  let cli = $state<string | null | undefined>(undefined)
  let history = $state<native.Transcript[]>([])
  let historyOpen = $state(false)
  let configOpen = $state(false)
  let editingTitle = $state(false)
  let titleDraft = $state("")
  let titleInput = $state<HTMLInputElement>()
  let draft = $state("")
  let input = $state<HTMLTextAreaElement>()
  let thread = $state<HTMLElement>()
  let mentions = $state<native.FileEntry[]>([])
  let picked = $state<Record<string, string[]>>({})
  let unit = $state(16)
  let panel = $state<HTMLElement>()
  let tipWidth = $state(0)
  let tipHeight = $state(0)
  let placed = false
  let grabX = 0
  let grabY = 0
  let lastX = 0
  let lastY = 0
  let travel = 0
  let slideTimer: ReturnType<typeof setTimeout> | undefined

  const px = (rem: number) => Math.round(rem * unit)

  const BUBBLE = $derived(px(3.5))

  const STACK_GAP = $derived(px(0.375))

  const STEP = $derived(BUBBLE + STACK_GAP)

  const PLUS = $derived(px(1.25))

  const ATTACH = $derived(px(1.75))

  const TIP_GAP = $derived(px(0.5))

  // ponytail: fixed panel size, add resizing when threads need more room
  const PANEL_WIDTH = $derived(px(27.5))

  const PANEL_HEIGHT = $derived(px(40))

  const GAP = $derived(px(0.75))

  const EDGE = $derived(px(0.5))

  const TARGET = $derived(px(4))

  const TARGET_BOTTOM = $derived(px(3.5))

  const CATCH = $derived(px(7.5))

  const SLOP = $derived(px(0.2))

  const snap = $derived(device.chatSnap / 100)

  const panelRadius = $derived(
    panel ? Number.parseFloat(getComputedStyle(panel).borderTopLeftRadius) : px(1),
  )

  const whole = $derived<native.ChatRect>({ x: 0, y: 0, width: area.width, height: area.height })

  const monitorAt = (x: number, y: number) =>
    area.monitors.find(m => x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height) ??
    area.monitors.reduce<native.ChatRect | null>((best, m) => {
      const distance = Math.hypot(m.x + m.width / 2 - x, m.y + m.height / 2 - y)

      return best && Math.hypot(best.x + best.width / 2 - x, best.y + best.height / 2 - y) <= distance
        ? best
        : m
    }, null) ??
    whole

  const layout = $derived.by(() => {
    const out = new Map<string, { left: number; top: number }>()
    const heads = new Map<string, { left: number; top: number; count: number }>()

    for (const b of bubbles) {
      const head = heads.get(b.stack)

      if (head) {
        out.set(b.id, { left: head.left, top: head.top + head.count * STEP })
        head.count += 1
      } else {
        heads.set(b.stack, { left: b.left, top: b.top, count: 1 })
        out.set(b.id, { left: b.left, top: b.top })
      }
    }

    return out
  })

  const at = (b: Bubble) => layout.get(b.id) ?? { left: b.left, top: b.top }

  const headOf = (stack: string) => bubbles.find(b => b.stack === stack)

  const membersOf = (stack: string) => bubbles.filter(b => b.stack === stack)

  const heightOf = (stack: string) => membersOf(stack).length * STEP - STACK_GAP

  const cornerOf = (b: Bubble) => headOf(b.stack)?.corner ?? b.corner

  const current = $derived(bubbles.find(b => b.id === openId) ?? null)

  const session = $derived(current?.session ?? null)

  const open = $derived(current !== null)

  const dragged = $derived(bubbles.find(b => b.id === dragId) ?? null)

  const dragging = $derived(dragged !== null && moved)

  const hovered = $derived(
    dragId === null ? (bubbles.find(b => b.id === hoverId) ?? null) : null,
  )

  const anchor = $derived(current ? at(current) : { left: 0, top: 0 })

  const corner = $derived(current ? cornerOf(current) : { right: true, bottom: true })

  const screen = $derived(monitorAt(anchor.left + BUBBLE / 2, anchor.top + BUBBLE / 2))

  const dragScreen = $derived(
    dragged ? monitorAt(dragged.left + BUBBLE / 2, dragged.top + BUBBLE / 2) : screen,
  )

  const targetX = $derived(dragScreen.x + dragScreen.width / 2)

  const targetY = $derived(dragScreen.y + dragScreen.height - TARGET_BOTTOM - TARGET / 2)

  const overTarget = $derived(
    dragging &&
      dragged !== null &&
      Math.hypot(dragged.left + BUBBLE / 2 - targetX, dragged.top + BUBBLE / 2 - targetY) < CATCH,
  )

  const panelLeft = $derived(
    Math.min(
      Math.max(
        screen.x + EDGE,
        corner.right ? anchor.left - GAP - PANEL_WIDTH : anchor.left + BUBBLE + GAP,
      ),
      screen.x + screen.width - PANEL_WIDTH - EDGE,
    ),
  )

  const panelTop = $derived(
    Math.min(
      Math.max(screen.y + EDGE, corner.bottom ? anchor.top + BUBBLE - PANEL_HEIGHT : anchor.top),
      screen.y + screen.height - PANEL_HEIGHT - EDGE,
    ),
  )

  const origin = $derived(
    `${corner.right ? "right" : "left"} ${corner.bottom ? "bottom" : "top"}`,
  )

  const cwd = $derived(current?.folder || null)

  const folderNameOf = (folder: string) =>
    folder.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? ""

  const folderName = $derived(folderNameOf(current?.folder ?? ""))

  const anyBusy = $derived(bubbles.some(b => b.session?.busy))

  const contextPercent = $derived(
    session && session.contextWindow > 0
      ? Math.min(100, Math.round((session.context / session.contextWindow) * 100))
      : 0,
  )

  const startKey = (d: DeviceSettings) =>
    JSON.stringify([
      d.chatEffort,
      d.chatThinking,
      d.chatAutoCompact,
      d.chatLanguage,
      d.chatBudget,
      d.chatSystemPrompt,
    ])

  const stale = $derived(
    current !== null && current.session !== null && current.started !== startKey(device),
  )

  const LOCAL = $derived<Command[]>(
    LOCAL_NAMES.map(name => ({ name, description: $t(`chat.commands.${name}`) })),
  )

  const slashTerm = $derived(
    draft.startsWith("/") && !draft.includes(" ") ? draft.slice(1) : null,
  )

  const commands = $derived(
    slashTerm === null
      ? []
      : [
          ...LOCAL,
          ...(session?.info.commands ?? []).filter(
            command => !LOCAL.some(local => local.name === command.name),
          ),
        ]
          .filter(command => command.name.startsWith(slashTerm))
          .sort((a, b) => Number(b.name === slashTerm) - Number(a.name === slashTerm))
          .slice(0, 8),
  )

  const mentionTerm = $derived.by(() => {
    const at = draft.lastIndexOf("@")

    if (at < 0) {
      return null
    }

    const before = at === 0 ? " " : draft[at - 1]
    const term = draft.slice(at + 1)

    return (before === " " || before === "\n") && !term.includes(" ") ? term : null
  })

  const titleOf = (b: Bubble) => {
    if (b.title) {
      return b.title
    }

    const first = b.session?.turns.find(turn => turn.role === "user")?.blocks[0]
    const text = first?.kind === "text" ? first.text.trim().split("\n")[0] : ""

    if (text) {
      return text.slice(0, TITLE_LIMIT)
    }

    return b.folder ? folderNameOf(b.folder) : $t("chat.title")
  }

  const previewOf = (b: Bubble) => {
    const turns = b.session?.turns ?? []

    for (let i = turns.length - 1; i >= 0; i -= 1) {
      for (let j = turns[i].blocks.length - 1; j >= 0; j -= 1) {
        const block = turns[i].blocks[j]

        if (block.kind === "text" && block.text.trim()) {
          return block.text.trim().slice(0, PREVIEW_LIMIT)
        }
      }
    }

    return ""
  }

  const tipOf = (b: Bubble) => {
    if (device.chatHover === "none") {
      return ""
    }

    return device.chatHover === "preview" ? previewOf(b) || titleOf(b) : titleOf(b)
  }

  const moodOf = (b: Bubble): Mood => {
    const s = b.session

    if (s?.permission || s?.prompt) {
      return "attention"
    }

    if (s?.busy) {
      return "busy"
    }

    if (b.unread) {
      return "unread"
    }

    return anyBusy ? "other" : "idle"
  }

  const colorOf = (b: Bubble) =>
    device.chatBubbleColors ? `oklch(72% 0.15 ${b.hue})` : "var(--color-primary)"

  const nextHue = () =>
    HUES.find(h => !bubbles.some(b => b.hue === h)) ?? HUES[bubbles.length % HUES.length]

  const make = (from: Partial<Bubble> = {}): Bubble => ({
    id: crypto.randomUUID(),
    hue: nextHue(),
    stack: crypto.randomUUID(),
    left: 0,
    top: 0,
    corner: { right: true, bottom: true },
    folder: "",
    session: null,
    unread: false,
    title: "",
    seen: 0,
    started: "",
    ...from,
  })

  const place = () => {
    const home = area.monitors[area.home] ?? whole

    bubbles = [
      make({
        hue: HUES[0],
        left: home.x + home.width - BUBBLE - EDGE,
        top: home.y + home.height - BUBBLE - EDGE,
        folder: stored.folder ?? "",
      }),
    ]
  }

  const glide = (from: { left: number; top: number }, to: Bubble, height: number) => {
    slide = [
      Math.min(from.left, to.left),
      Math.min(from.top, to.top),
      Math.max(from.left, to.left) + BUBBLE,
      Math.max(from.top, to.top) + height,
      0,
    ]

    clearTimeout(slideTimer)
    slideTimer = setTimeout(() => {
      slide = null
    }, SLIDE)
  }

  const settle = (stack: string) => {
    const head = headOf(stack)

    if (!head) {
      return
    }

    const height = heightOf(stack)
    const from = { left: head.left, top: head.top }
    const centerX = head.left + BUBBLE / 2
    const centerY = head.top + height / 2
    const m = monitorAt(centerX, centerY)
    const minLeft = m.x + EDGE
    const minTop = m.y + EDGE
    const maxLeft = m.x + m.width - BUBBLE - EDGE
    const maxTop = m.y + m.height - height - EDGE
    const fromLeft = (centerX - m.x) / m.width
    const fromTop = (centerY - m.y) / m.height
    let left = head.left
    let top = head.top

    head.corner = { right: fromLeft >= 0.5, bottom: fromTop >= 0.5 }

    if (fromLeft < snap) {
      left = minLeft
    } else if (fromLeft > 1 - snap) {
      left = maxLeft
    }

    if (fromTop < snap) {
      top = minTop
    } else if (fromTop > 1 - snap) {
      top = maxTop
    }

    head.left = Math.min(Math.max(minLeft, left), maxLeft)
    head.top = Math.min(Math.max(minTop, top), maxTop)

    if (head.left !== from.left || head.top !== from.top) {
      glide(from, head, height)
    }
  }

  const settleAll = () => {
    for (const stack of new Set(bubbles.map(b => b.stack))) {
      settle(stack)
    }
  }

  const load = async () => {
    unit = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)

    const next = await native.chatArea().catch(() => null)

    if (!next) {
      return
    }

    area = next

    if (placed) {
      settleAll()
    } else {
      place()
      placed = true
    }
  }

  const remember = () => {
    const folder = current?.folder ?? bubbles[0]?.folder ?? ""

    if (folder && !recent.includes(folder)) {
      recent = [folder, ...recent].slice(0, RECENT_LIMIT)
    }

    localStorage.setItem(STORAGE, JSON.stringify({ folder, recent }))
  }

  const update = async (patch: Partial<DeviceSettings>) => {
    device = { ...device, ...patch }
    await saveDevice($state.snapshot(device)).catch(() => undefined)
  }

  const setPermission = async (mode: ChatPermission) => {
    await update({ chatPermission: mode })
    await session?.setPermissionMode(mode)
  }

  const setModel = async (model: string) => {
    await update({ chatModel: model.trim() })
    await session?.setModel(model.trim())
  }

  const fresh = async (b: Bubble, resume: string | null = null) => {
    await b.session?.stop()

    const next = new ClaudeSession()

    b.session = next
    b.started = startKey(device)
    historyOpen = false
    configOpen = false
    picked = {}

    const folder = b.folder || null
    const past = resume ? await native.claudeTranscript(folder, resume).catch(() => []) : []

    await next
      .start({
        cwd: folder,
        resume,
        plain: !b.folder,
        permissionMode: device.chatPermission,
        model: device.chatModel,
        effort: device.chatEffort,
        thinking: device.chatThinking,
        autoCompact: device.chatAutoCompact,
        language: device.chatLanguage,
        budget: device.chatBudget,
        systemPrompt: device.chatSystemPrompt,
        history: past,
      })
      .catch(e => {
        next.error = String(e)
      })
  }

  const restart = async () => {
    if (current) {
      await fresh(current, current.session?.info.id || null)
    }
  }

  const loadHistory = async () => {
    history = await native.claudeSessions(cwd).catch(() => [])
    historyOpen = true
    configOpen = false
  }

  const chooseFolder = async () => {
    if (!current) {
      return
    }

    const choice = await pickDirectory({
      directory: true,
      defaultPath: current.folder || undefined,
    }).catch(() => null)

    if (typeof choice !== "string") {
      return
    }

    current.folder = choice
    remember()
    await fresh(current)
  }

  const useFolder = async (path: string) => {
    if (!current) {
      return
    }

    current.folder = path
    remember()
    await fresh(current)
  }

  const closeFolder = async () => {
    if (!current) {
      return
    }

    current.folder = ""
    remember()
    await fresh(current)
  }

  const showUsage = async () => {
    if (!current) {
      return
    }

    if (!current.session) {
      await fresh(current)
    }

    const fallback = current.session?.usage
      ? null
      : await native.claudeUsage(null).catch(() => null)

    current.session?.showUsage(fallback)
  }

  const runLocal = async (text: string) => {
    const name = text.slice(1).split(" ")[0]

    if (name === "clear") {
      if (current) {
        await fresh(current)
      }
    } else if (name === "resume") {
      await loadHistory()
    } else if (name === "usage") {
      await showUsage()
    } else if (name === "model" || name === "effort" || name === "config") {
      configOpen = true
      historyOpen = false
    } else {
      return false
    }

    return true
  }

  const send = async () => {
    const text = draft.trim()

    if (!text || !current) {
      return
    }

    draft = ""

    if (text.startsWith("/") && (await runLocal(text))) {
      return
    }

    if (!current.session) {
      await fresh(current)
    }

    const s = current.session

    if (!s) {
      return
    }

    if (s.busy) {
      await s.enqueue(text, device.chatQueueMode)
    } else {
      await s.send(text)
    }
  }

  const capture = (e: PointerEvent, on: boolean) => {
    const target = e.currentTarget as HTMLElement

    try {
      if (on) {
        target.setPointerCapture(e.pointerId)
      } else {
        target.releasePointerCapture(e.pointerId)
      }
    } catch {
      return
    }
  }

  const completeCommand = (command: string) => {
    draft = `/${command} `
    input?.focus()
  }

  const relative = (path: string) => {
    const root = cwd ?? ""

    if (!root || !path.startsWith(root)) {
      return path
    }

    const rest = path.slice(root.length)

    return rest.startsWith("\\") || rest.startsWith("/") ? rest.slice(1) : rest
  }

  const completeMention = (entry: native.FileEntry) => {
    const at = draft.lastIndexOf("@")

    draft = `${draft.slice(0, at)}@${relative(entry.path).replaceAll("\\", "/")} `
    mentions = []
    input?.focus()
  }

  const pick = (question: Question, label: string) => {
    const current = picked[question.question] ?? []

    picked = {
      ...picked,
      [question.question]: question.multiSelect
        ? current.includes(label)
          ? current.filter(item => item !== label)
          : [...current, label]
        : [label],
    }
  }

  const submitAnswers = () => {
    if (!session?.prompt) {
      return
    }

    const answers = Object.fromEntries(
      session.prompt.questions.map(question => [
        question.question,
        (picked[question.question] ?? []).join(", "),
      ]),
    )

    picked = {}
    session.answer(answers)
  }

  const summary = (input: unknown) => {
    const fields = (input ?? {}) as Record<string, unknown>
    const value =
      fields.command ??
      fields.file_path ??
      fields.pattern ??
      fields.path ??
      fields.query ??
      fields.url ??
      fields.description ??
      fields.prompt

    return typeof value === "string" ? value : JSON.stringify(fields).slice(0, 160)
  }

  const when = (seconds: number) =>
    new Date(seconds * 1000).toLocaleString(currentLocale(), {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })

  const openPanel = (id: string) => {
    const b = bubbles.find(x => x.id === id)

    if (!b) {
      return
    }

    openId = id
    lastId = id
    b.unread = false
    historyOpen = false
    configOpen = false
    editingTitle = false
    appWindow.setFocus().catch(() => undefined)
    tick().then(() => input?.focus())

    if (!b.session && cli !== null) {
      fresh(b)
    }
  }

  const closePanel = () => {
    openId = null
    editingTitle = false
  }

  const toggle = (id?: string) => {
    const target = id ?? lastId ?? bubbles[0]?.id

    if (!target) {
      return
    }

    if (openId === target) {
      closePanel()
    } else {
      openPanel(target)
    }
  }

  const hide = () => {
    closePanel()
    native.hideWindow("chat").catch(() => undefined)
  }

  const spawn = (from: Bubble, above: boolean) => {
    if (!device.chatMultiBubble) {
      return
    }

    const index = bubbles.findIndex(b => b.id === from.id)
    const isHead = headOf(from.stack)?.id === from.id
    const nb = make({
      stack: from.stack,
      left: from.left,
      top: above && isHead ? from.top - STEP : from.top,
      corner: { ...from.corner },
      folder: from.folder,
    })
    const cut = index + (above ? 0 : 1)

    bubbles = [...bubbles.slice(0, cut), nb, ...bubbles.slice(cut)]
    hoverId = null
    settle(nb.stack)
    openPanel(nb.id)
  }

  const remove = (b: Bubble) => {
    if (bubbles.length === 1) {
      hide()

      return
    }

    const members = membersOf(b.stack)
    const next = members[0]?.id === b.id ? members[1] : undefined

    if (next) {
      const p = at(next)

      next.left = p.left
      next.top = p.top
    }

    b.session?.stop()

    if (openId === b.id) {
      closePanel()
    }

    if (lastId === b.id) {
      lastId = null
    }

    bubbles = bubbles.filter(x => x.id !== b.id)
    settleAll()
  }

  const attach = (b: Bubble) => {
    const moving = membersOf(b.stack)

    for (const other of bubbles) {
      if (other.stack === b.stack || headOf(other.stack)?.id !== other.id) {
        continue
      }

      const count = membersOf(other.stack).length
      const aboveTop = other.top - moving.length * STEP
      const belowTop = other.top + count * STEP
      const nearAbove = Math.hypot(b.left - other.left, b.top - aboveTop) < ATTACH
      const nearBelow = Math.hypot(b.left - other.left, b.top - belowTop) < ATTACH

      if (!nearAbove && !nearBelow) {
        continue
      }

      const rest = bubbles.filter(x => x.stack !== b.stack)
      const index = nearAbove
        ? rest.findIndex(x => x.id === other.id)
        : rest.map(x => x.stack).lastIndexOf(other.stack) + 1

      if (nearAbove) {
        b.left = other.left
        b.top = aboveTop
      }

      for (const m of moving) {
        m.stack = other.stack
      }

      bubbles = [...rest.slice(0, index), ...moving, ...rest.slice(index)]
      settle(other.stack)

      return true
    }

    return false
  }

  const grab = (e: PointerEvent, b: Bubble) => {
    if (e.button !== 0) {
      return
    }

    const p = at(b)

    grabX = e.clientX - p.left
    grabY = e.clientY - p.top
    lastX = e.clientX
    lastY = e.clientY
    travel = 0
    moved = false
    dragId = b.id
    hoverId = null
    capture(e, true)
  }

  const move = (e: PointerEvent) => {
    const b = dragged

    if (!b) {
      return
    }

    travel += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY)
    lastX = e.clientX
    lastY = e.clientY

    if (!moved) {
      if (travel < SLOP) {
        return
      }

      moved = true

      if (headOf(b.stack)?.id !== b.id) {
        const p = at(b)

        b.left = p.left
        b.top = p.top
        b.stack = crypto.randomUUID()
      }
    }

    b.left = e.clientX - grabX
    b.top = e.clientY - grabY
  }

  const release = (e: PointerEvent) => {
    const b = dragged

    if (!b) {
      return
    }

    capture(e, false)

    const wasMoved = moved
    const dropped = overTarget

    dragId = null
    moved = false

    if (!wasMoved) {
      toggle(b.id)

      return
    }

    if (dropped) {
      remove(b)

      return
    }

    if (device.chatMultiBubble && attach(b)) {
      return
    }

    settle(b.stack)
  }

  const startRename = () => {
    if (!current) {
      return
    }

    titleDraft = titleOf(current)
    editingTitle = true
    tick().then(() => titleInput?.select())
  }

  const commitRename = () => {
    if (current && editingTitle) {
      current.title = titleDraft.trim()
    }

    editingTitle = false
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      if (editingTitle) {
        editingTitle = false

        return
      }

      if (historyOpen || configOpen || commands.length > 0 || mentions.length > 0) {
        historyOpen = false
        configOpen = false
        mentions = []
        draft = commands.length > 0 ? "" : draft

        return
      }

      closePanel()
    }
  }

  const compose = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === "Tab") && commands.length > 0 && slashTerm !== null) {
      e.preventDefault()
      completeCommand(commands[0].name)

      return
    }

    if (e.key === "Tab" && mentions.length > 0) {
      e.preventDefault()
      completeMention(mentions[0])

      return
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  $effect(() => {
    document.documentElement.dataset.surface = "overlay"
    load()
    native.claudeWhich().then(path => {
      cli = path
    })

    ensureDevice().then(d => {
      device = d
    })

    const stopEditWatch = watchEdit()

    const stops = [
      native.onWindowShown("chat", load),
      native.onChatToggle(() => toggle()),
      onDevice(d => {
        device = d
      }),
      listen<{ percent: number; on: boolean }>("chat-snap-preview", e => {
        previewing = e.payload.on ? e.payload.percent : null
      }),
    ]

    return () => {
      stopEditWatch()

      for (const stop of stops) {
        stop.then(off => off()).catch(() => undefined)
      }

      for (const b of bubbles) {
        b.session?.stop()
      }
    }
  })

  $effect(() => {
    if (mentionTerm === null) {
      mentions = []

      return
    }

    const term = mentionTerm
    const timer = setTimeout(async () => {
      const root = cwd ?? session?.info.cwd ?? ""

      mentions = root
        ? (await native.searchDir(root, term).catch(() => [])).slice(0, 8)
        : []
    }, MENTION_DELAY)

    return () => clearTimeout(timer)
  })

  $effect(() => {
    void session?.turns.length
    void session?.turns.at(-1)?.blocks.length

    if (thread) {
      thread.scrollTop = thread.scrollHeight
    }
  })

  $effect(() => {
    for (const b of bubbles) {
      const results = b.session?.results ?? 0
      const seen = untrack(() => b.seen)

      if (results !== seen) {
        b.seen = results

        if (results > seen && openId !== b.id) {
          b.unread = true
        }
      }
    }
  })

  $effect(() => {
    if (area.width === 0) {
      return
    }

    const rects: number[][] = []

    if (previewing !== null || editing.on) {
      rects.push([0, 0, area.width, area.height, 0])
    } else {
      for (const b of bubbles) {
        const p = at(b)

        rects.push([p.left, p.top, p.left + BUBBLE, p.top + BUBBLE, BUBBLE / 2])
      }

      if (hovered && hovered.id !== openId) {
        const p = at(hovered)

        if (device.chatMultiBubble) {
          rects.push([p.left, p.top - PLUS / 2, p.left + BUBBLE, p.top + BUBBLE + PLUS / 2, BUBBLE / 2])
        }

        if (tipWidth > 0 && tipOf(hovered)) {
          const right = cornerOf(hovered).right
          const x = right ? p.left - TIP_GAP - tipWidth : p.left + BUBBLE + TIP_GAP
          const y = p.top + BUBBLE / 2 - tipHeight / 2

          rects.push([x, y, x + tipWidth, y + tipHeight, px(0.5)])
        }
      }

      if (open && !dragging) {
        rects.push([
          panelLeft,
          panelTop,
          panelLeft + PANEL_WIDTH,
          panelTop + PANEL_HEIGHT,
          panelRadius,
        ])
      }

      if (dragging) {
        rects.push([
          targetX - TARGET / 2,
          targetY - TARGET / 2,
          targetX + TARGET / 2,
          targetY + TARGET / 2,
          TARGET / 2,
        ])
      }

      if (slide) {
        rects.push(slide)
      }
    }

    native
      .chatFrame([0, 0, area.width, area.height], rects)
      .catch(() => undefined)
  })
</script>

<svelte:window {onkeydown} />

<div class="absolute top-0 left-0">
  {#if previewing !== null}
    {#each area.monitors as m, index (index)}
      {@const bandX = (m.width * previewing) / 100}
      {@const bandY = (m.height * previewing) / 100}

      {#each [[m.x, m.y, m.width, bandY], [m.x, m.y + m.height - bandY, m.width, bandY], [m.x, m.y, bandX, m.height], [m.x + m.width - bandX, m.y, bandX, m.height]] as [x, y, w, h], side (side)}
        <div
          class="pointer-events-none absolute border border-primary/40 bg-primary/15"
          style:left="{x}px"
          style:top="{y}px"
          style:width="{w}px"
          style:height="{h}px"
          aria-hidden="true"
        ></div>
      {/each}

      <div
        class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-box bg-base-100 px-4 py-2 text-lg font-medium tabular-nums shadow-xl"
        style:left="{m.x + m.width / 2}px"
        style:top="{m.y + m.height / 2}px"
        aria-hidden="true"
      >
        {previewing}%
      </div>
    {/each}
  {/if}

  {#if current && !dragging}
    <section
      bind:this={panel}
      class="absolute isolate flex flex-col overflow-hidden rounded-box border border-base-content/10 bg-base-100"
      style:left="{panelLeft}px"
      style:top="{panelTop}px"
      style:width="{PANEL_WIDTH}px"
      style:height="{PANEL_HEIGHT}px"
      style:transform-origin={origin}
      style:--bubble={colorOf(current)}
      transition:scale={{ duration: 220, start: 0.88, easing: cubicOut }}
      aria-label={titleOf(current)}
    >
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-primary/15 to-transparent"
        aria-hidden="true"
      ></div>

      <header class="flex shrink-0 items-center gap-1 px-4 pt-3 pb-2">
        <span class="bubble-swatch" aria-hidden="true"></span>

        {#if editingTitle}
          <input
            bind:this={titleInput}
            bind:value={titleDraft}
            class="input input-ghost input-xs w-40 text-sm font-medium"
            aria-label={$t("chat.rename")}
            onkeydown={e => {
              if (e.key === "Enter") {
                commitRename()
              }

              if (e.key === "Escape") {
                e.stopPropagation()
                editingTitle = false
              }
            }}
            onblur={commitRename}
          />
        {:else}
          <button
            type="button"
            class="max-w-40 truncate text-sm font-medium tracking-tight"
            title={$t("chat.rename")}
            onclick={startRename}
          >
            {titleOf(current)}
          </button>
        {/if}

        {#if current.folder}
          <span
            class="inline-flex max-w-32 items-center rounded-field bg-base-content/5 pl-2 text-xs"
          >
            <Icon icon="lucide:folder" class="size-3.5 shrink-0" />

            <button
              type="button"
              class="truncate px-1 py-1"
              title={current.folder}
              onclick={chooseFolder}
            >
              {folderName}
            </button>

            <button
              type="button"
              class="btn btn-circle btn-ghost btn-xs"
              aria-label={$t("chat.closeFolder")}
              onclick={closeFolder}
            >
              <Icon icon="lucide:x" class="size-3" />
            </button>
          </span>
        {:else}
          <button
            type="button"
            class="btn btn-ghost btn-xs gap-1 font-normal"
            onclick={chooseFolder}
          >
            <Icon icon="lucide:folder-open" class="size-3.5" />

            {$t("chat.openFolder")}
          </button>
        {/if}

        <span class="grow"></span>

        <button
          type="button"
          class={["btn btn-circle btn-ghost btn-xs", configOpen && "btn-active"]}
          title={$t("chat.config.title")}
          aria-label={$t("chat.config.title")}
          onclick={() => {
            configOpen = !configOpen
            historyOpen = false
          }}
        >
          <Icon icon="lucide:sliders-horizontal" class="size-4" />
        </button>

        <button
          type="button"
          class="btn btn-circle btn-ghost btn-xs"
          title={$t("chat.history.title")}
          aria-label={$t("chat.history.title")}
          onclick={loadHistory}
        >
          <Icon icon="lucide:history" class="size-4" />
        </button>

        <button
          type="button"
          class="btn btn-circle btn-ghost btn-xs"
          title={$t("chat.newChat")}
          aria-label={$t("chat.newChat")}
          onclick={() => current && fresh(current)}
        >
          <Icon icon="lucide:plus" class="size-4" />
        </button>

        <button
          type="button"
          class="btn btn-circle btn-ghost btn-xs"
          aria-label={$t("common.close")}
          onclick={closePanel}
        >
          <Icon icon="lucide:x" class="size-4" />
        </button>
      </header>

      {#if configOpen}
        <div class="flex min-h-0 grow flex-col gap-3 overflow-y-auto px-4 pb-3 text-sm">
          <div class="flex items-center justify-between">
            <p class="font-medium">{$t("chat.config.title")}</p>

            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onclick={() => (configOpen = false)}
            >
              <Icon icon="lucide:arrow-left" class="size-3.5" />

              {$t("common.back")}
            </button>
          </div>

          <label class="flex flex-col gap-1">
            <span class="text-xs text-base-content/60">{$t("chat.config.model")}</span>

            <input
              class="input input-sm w-full"
              list="chat-models"
              placeholder={$t("chat.config.modelDefault")}
              value={device.chatModel}
              onchange={e => setModel((e.currentTarget as HTMLInputElement).value)}
            />

            <datalist id="chat-models">
              {#each MODELS as model (model)}
                <option value={model}></option>
              {/each}
            </datalist>
          </label>

          <label class="flex items-center justify-between gap-3">
            <span>{$t("chat.config.effort")}</span>

            <select
              class="select select-sm w-36"
              value={device.chatEffort}
              onchange={e => update({ chatEffort: (e.currentTarget as HTMLSelectElement).value as ChatEffort })}
            >
              {#each EFFORTS as effort (effort)}
                <option value={effort}>{$t(`chat.effort.${effort || "default"}`)}</option>
              {/each}
            </select>
          </label>

          <label class="flex items-center justify-between gap-3">
            <span>{$t("chat.config.permission")}</span>

            <select
              class="select select-sm w-36"
              value={device.chatPermission}
              onchange={e => setPermission((e.currentTarget as HTMLSelectElement).value as ChatPermission)}
            >
              {#each PERMISSIONS as mode (mode)}
                <option value={mode}>{$t(`chat.permission.${mode}`)}</option>
              {/each}
            </select>
          </label>

          <label class="flex items-center justify-between gap-3">
            <span>{$t("chat.config.thinking")}</span>

            <select
              class="select select-sm w-36"
              value={device.chatThinking}
              onchange={e => update({ chatThinking: (e.currentTarget as HTMLSelectElement).value as ChatTri })}
            >
              {#each TRIS as tri (tri)}
                <option value={tri}>{$t(`chat.tri.${tri}`)}</option>
              {/each}
            </select>
          </label>

          <label class="flex items-center justify-between gap-3">
            <span>{$t("chat.config.autoCompact")}</span>

            <select
              class="select select-sm w-36"
              value={device.chatAutoCompact}
              onchange={e => update({ chatAutoCompact: (e.currentTarget as HTMLSelectElement).value as ChatTri })}
            >
              {#each TRIS as tri (tri)}
                <option value={tri}>{$t(`chat.tri.${tri}`)}</option>
              {/each}
            </select>
          </label>

          <label class="flex items-center justify-between gap-3">
            <span>{$t("chat.config.language")}</span>

            <input
              class="input input-sm w-36"
              placeholder={$t("chat.config.languageDefault")}
              value={device.chatLanguage}
              onchange={e => update({ chatLanguage: (e.currentTarget as HTMLInputElement).value.trim() })}
            />
          </label>

          <label class="flex items-center justify-between gap-3">
            <span>{$t("chat.config.budget")}</span>

            <input
              type="number"
              min="0"
              step="0.5"
              class="input input-sm w-36"
              placeholder={$t("chat.config.budgetNone")}
              value={device.chatBudget || ""}
              onchange={e => update({ chatBudget: Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0) })}
            />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs text-base-content/60">{$t("chat.config.systemPrompt")}</span>

            <textarea
              class="textarea textarea-sm w-full"
              rows="3"
              value={device.chatSystemPrompt}
              onchange={e => update({ chatSystemPrompt: (e.currentTarget as HTMLTextAreaElement).value })}
            ></textarea>
          </label>

          {#if stale}
            <div class="flex items-center justify-between gap-3 rounded-field bg-warning/10 px-3 py-2 text-xs">
              <span>{$t("chat.config.restartHint")}</span>

              <button type="button" class="btn btn-warning btn-xs" onclick={restart}>
                {$t("chat.config.restart")}
              </button>
            </div>
          {/if}
        </div>
      {:else if historyOpen}
        <div class="flex min-h-0 grow flex-col px-3 pb-3">
          <div class="flex items-center justify-between px-2 pb-1">
            <p class="text-xs text-base-content/50">{cwd ?? $t("chat.history.home")}</p>

            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onclick={() => (historyOpen = false)}
            >
              <Icon icon="lucide:arrow-left" class="size-3.5" />

              {$t("common.back")}
            </button>
          </div>

          <ul class="min-h-0 grow space-y-0.5 overflow-y-auto">
            {#if session && session.turns.length > 0}
              <li>
                <button
                  type="button"
                  class="flex w-full flex-col items-start gap-0.5 rounded-field border border-primary/30 bg-primary/10 px-2 py-1.5 text-left"
                  onclick={() => (historyOpen = false)}
                >
                  <span class="line-clamp-1 text-sm">{titleOf(current)}</span>

                  <span class="text-2xs text-primary">{$t("chat.history.current")}</span>
                </button>
              </li>
            {/if}

            {#each history.filter(item => item.id !== session?.info.id) as item (item.id)}
              <li>
                <button
                  type="button"
                  class="flex w-full flex-col items-start gap-0.5 rounded-field px-2 py-1.5 text-left hover:bg-base-content/10"
                  onclick={() => current && fresh(current, item.id)}
                >
                  <span class="line-clamp-1 text-sm">{item.title || $t("chat.history.untitled")}</span>

                  <span class="text-2xs text-base-content/50">
                    {$t("chat.history.meta", { values: { count: item.messages, when: when(item.modified) } })}
                  </span>
                </button>
              </li>
            {:else}
              <li class="px-2 py-4 text-sm text-base-content/50">{$t("chat.history.empty")}</li>
            {/each}
          </ul>

          {#if recent.length > 0}
            <p class="px-2 pt-2 pb-1 text-xs text-base-content/50">{$t("chat.history.recentFolders")}</p>

            <ul class="max-h-28 space-y-0.5 overflow-y-auto">
              {#each recent as path (path)}
                <li>
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 truncate rounded-field px-2 py-1 text-left text-xs hover:bg-base-content/10"
                    title={path}
                    onclick={() => useFolder(path)}
                  >
                    <Icon icon="lucide:folder" class="size-3.5 shrink-0" />

                    <span class="truncate">{path}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {:else}
        <div
          bind:this={thread}
          class="flex min-h-0 grow flex-col gap-2 overflow-y-auto px-4 py-2"
        >
          {#if cli === null}
            <div class="m-auto flex flex-col items-center gap-2 text-center text-sm">
              <Icon icon="lucide:terminal" class="size-7 text-base-content/50" />

              <p>{$t("chat.cliMissing")}</p>

              <code class="rounded-field bg-base-content/10 px-2 py-1 text-xs"
                >npm install -g @anthropic-ai/claude-code</code
              >
            </div>
          {:else if !session || session.turns.length === 0}
            <div class="m-auto flex flex-col items-center gap-3 text-center">
              <Icon icon={claudeIcon} class="size-8 text-primary/70" />

              <p class="text-sm text-base-content/50">
                {current.folder ? $t("chat.empty.code") : $t("chat.empty.ask")}
              </p>

              <p class="text-xs text-base-content/40">
                {current.folder ? $t("chat.empty.codeHint") : $t("chat.empty.askHint")}
              </p>
            </div>
          {:else}
            {#each session.turns as turn (turn.id)}
              {#if turn.role === "user"}
                <div
                  class="max-w-5/6 self-end rounded-box rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-primary-content"
                >
                  {turn.blocks[0]?.kind === "text" ? turn.blocks[0].text : ""}
                </div>
              {:else}
                {#each turn.blocks as block, index (index)}
                  {#if block.kind === "usage"}
                    <div
                      class="flex w-64 max-w-11/12 flex-col gap-2 self-start rounded-box border border-base-content/10 bg-base-100/60 p-3 text-xs"
                    >
                      {#each [[$t("chat.usage.fiveHour"), block.usage.fiveHour], [$t("chat.usage.sevenDay"), block.usage.sevenDay]] as const as [name, window] (name)}
                        {#if window}
                          <div>
                            <div class="flex items-center justify-between">
                              <span class="text-base-content/70">{name}</span>

                              <span class="tabular-nums">{Math.round(window.used)}%</span>
                            </div>

                            <progress
                              class="progress progress-primary mt-1 w-full"
                              value={Math.round(window.used)}
                              max="100"
                            ></progress>

                            {#if window.resetsAt}
                              <p class="mt-0.5 text-base-content/50">
                                {$t("chat.usage.resets", { values: { time: when(new Date(window.resetsAt).getTime() / 1000) } })}
                              </p>
                            {/if}
                          </div>
                        {/if}
                      {/each}
                    </div>
                  {:else if block.kind === "text" && block.text.trim()}
                    <div
                      class="max-w-11/12 self-start rounded-box rounded-bl-md bg-base-content/10 px-4 py-2.5 text-sm leading-relaxed"
                    >
                      <Markdown text={block.text} />
                    </div>
                  {:else if block.kind === "tool"}
                    <details
                      class="max-w-11/12 self-start rounded-field border border-base-content/10 bg-base-100/60 text-xs"
                    >
                      <summary
                        class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-base-content/70"
                      >
                        <Icon
                          icon={block.error ? "lucide:circle-x" : block.result === null ? "lucide:loader" : "lucide:wrench"}
                          class={["size-3.5 shrink-0", block.error && "text-error", block.result === null && "animate-spin"]}
                        />

                        <span class="font-medium">{block.name}</span>

                        <span class="truncate text-base-content/50">{summary(block.input)}</span>
                      </summary>

                      {#if block.result}
                        <pre
                          class="max-h-48 overflow-auto border-t border-base-content/10 px-3 py-2 whitespace-pre-wrap">{block.result.slice(0, 4000)}</pre>
                      {/if}
                    </details>
                  {/if}
                {/each}

                {#if turn.streaming && turn.blocks.length === 0}
                  <span class="loading loading-dots loading-sm self-start text-base-content/50"></span>
                {/if}
              {/if}
            {/each}
          {/if}

          {#if session?.permission}
            {@const permission = session.permission}

            <div class="self-stretch rounded-box border border-warning/40 bg-warning/10 p-3 text-sm">
              <p class="flex items-center gap-2 font-medium">
                <Icon icon="lucide:shield-alert" class="size-4 text-warning" />

                {permission.tool}
              </p>

              <p class="mt-1 truncate text-xs text-base-content/70" title={summary(permission.input)}>
                {summary(permission.input)}
              </p>

              <div class="mt-2 flex justify-end gap-1">
                <button type="button" class="btn btn-ghost btn-xs" onclick={() => session?.deny()}>
                  {$t("chat.deny")}
                </button>

                {#if permission.suggestions}
                  <button type="button" class="btn btn-ghost btn-xs" onclick={() => session?.allow(true)}>
                    {$t("chat.allowAlways")}
                  </button>
                {/if}

                <button type="button" class="btn btn-primary btn-xs" onclick={() => session?.allow(false)}>
                  {$t("chat.allow")}
                </button>
              </div>
            </div>
          {/if}

          {#if session?.prompt}
            <div class="flex flex-col gap-3 self-stretch rounded-box border border-primary/30 bg-primary/5 p-3 text-sm">
              {#each session.prompt.questions as question (question.question)}
                <div>
                  <p class="text-2xs font-medium tracking-wide text-primary uppercase">{question.header}</p>

                  <p class="mt-0.5">{question.question}</p>

                  <div class="mt-2 flex flex-col gap-1">
                    {#each question.options as option (option.label)}
                      {@const on = (picked[question.question] ?? []).includes(option.label)}

                      <button
                        type="button"
                        class={[
                          "rounded-field border px-3 py-1.5 text-left transition-colors duration-150",
                          on
                            ? "border-primary/60 bg-primary/15"
                            : "border-base-content/10 hover:bg-base-content/10",
                        ]}
                        onclick={() => pick(question, option.label)}
                      >
                        <span class="block text-sm">{option.label}</span>

                        {#if option.description}
                          <span class="block text-xs text-base-content/60">{option.description}</span>
                        {/if}
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}

              <button
                type="button"
                class="btn btn-primary btn-sm self-end"
                disabled={session.prompt.questions.some(q => !(picked[q.question] ?? []).length)}
                onclick={submitAnswers}
              >
                {$t("common.submit")}
              </button>
            </div>
          {/if}

          {#if session?.error}
            <p class="self-stretch rounded-field bg-error/10 px-3 py-2 text-xs text-error whitespace-pre-wrap">
              {session.error}
            </p>
          {/if}
        </div>
      {/if}

      <div class={["relative shrink-0 p-3", (historyOpen || configOpen) && "hidden"]}>
        {#if commands.length > 0 || mentions.length > 0}
          <ul
            class="absolute inset-x-3 bottom-full mb-1 max-h-56 overflow-y-auto rounded-box border border-base-content/10 bg-base-100/95 p-1 text-sm shadow-xl"
          >
            {#each commands as command (command.name)}
              <li>
                <button
                  type="button"
                  class="flex w-full items-baseline gap-2 rounded-field px-2 py-1 text-left hover:bg-base-content/10"
                  onclick={() => completeCommand(command.name)}
                >
                  <span class="shrink-0">/{command.name}</span>

                  <span class="truncate text-xs text-base-content/50">{command.description}</span>
                </button>
              </li>
            {/each}

            {#each mentions as entry (entry.path)}
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-field px-2 py-1 text-left hover:bg-base-content/10"
                  title={entry.path}
                  onclick={() => completeMention(entry)}
                >
                  <Icon icon={entry.directory ? "lucide:folder" : "lucide:file"} class="size-3.5 shrink-0 text-base-content/60" />

                  <span class="truncate">{relative(entry.path)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        {#if session && session.queue.length > 0}
          <ul class="mb-1.5 flex flex-col gap-1">
            {#each session.queue as item (item.id)}
              <li
                class="flex items-center gap-1 rounded-field border border-base-content/10 bg-base-100/70 py-0.5 pr-0.5 pl-3 text-xs"
              >
                <Icon icon="lucide:clock" class="size-3.5 shrink-0 text-base-content/50" />

                <span class="grow truncate" title={item.text}>{item.text}</span>

                <button
                  type="button"
                  class="btn btn-ghost btn-xs font-normal"
                  disabled={item.handed}
                  title={$t("chat.queue.toggle")}
                  onclick={() => session?.setQueueMode(item.id, item.mode === "afterTool" ? "afterReply" : "afterTool")}
                >
                  {$t(`chat.queue.${item.mode}`)}
                </button>

                {#if !item.handed}
                  <button
                    type="button"
                    class="btn btn-circle btn-ghost btn-xs"
                    aria-label={$t("common.cancel")}
                    onclick={() => session?.cancelQueued(item.id)}
                  >
                    <Icon icon="lucide:x" class="size-3" />
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}

        <div
          class="flex items-end gap-2 rounded-box border border-base-content/10 bg-base-100/70 py-1.5 pr-1.5 pl-4"
        >
          <textarea
            bind:this={input}
            bind:value={draft}
            onkeydown={compose}
            rows="1"
            placeholder={session?.busy ? $t("chat.queuePlaceholder") : $t("chat.placeholder")}
            class="max-h-28 min-h-8 grow resize-none bg-transparent py-1 text-sm outline-none placeholder:text-base-content/35"
          ></textarea>

          {#if session?.busy}
            <button
              type="button"
              class="btn btn-circle btn-ghost btn-sm"
              aria-label={$t("chat.stop")}
              title={$t("chat.stop")}
              onclick={() => session?.interrupt()}
            >
              <Icon icon="lucide:square" class="size-4" />
            </button>
          {/if}

          <div
            class="relative rounded-full p-0.5"
            title={session && session.context > 0
              ? $t("chat.context", {
                  values: {
                    percent: contextPercent,
                    used: session.context.toLocaleString(currentLocale()),
                    total: session.contextWindow.toLocaleString(currentLocale()),
                  },
                })
              : undefined}
          >
            {#if session && session.context > 0}
              <span
                class="context-ring"
                style:--pct="{contextPercent}%"
                style:--ring={contextPercent >= 80 ? "var(--color-warning)" : "var(--color-primary)"}
                aria-hidden="true"
              ></span>
            {/if}

            <button
              type="button"
              class={["btn btn-circle btn-sm relative", session?.busy ? "btn-soft btn-primary" : "btn-primary"]}
              aria-label={session?.busy ? $t("chat.queueSend") : $t("chat.send")}
              disabled={!draft.trim() || cli === null}
              onclick={send}
            >
              <Icon icon={session?.busy ? "lucide:clock" : "lucide:arrow-up"} class="size-4" />
            </button>
          </div>
        </div>

        <div class="mt-1 flex items-center gap-1 px-1 text-3xs text-base-content/50">
          <select
            class="select select-ghost select-xs h-6 w-auto max-w-24 pr-6 text-2xs"
            aria-label={$t("chat.config.model")}
            title={session?.info.model || $t("chat.config.model")}
            value={MODELS.includes(device.chatModel) || device.chatModel === "" ? device.chatModel : "custom"}
            onchange={e => {
              const value = (e.currentTarget as HTMLSelectElement).value

              if (value === "custom") {
                configOpen = true
              } else {
                setModel(value)
              }
            }}
          >
            <option value="">{$t("chat.config.modelDefault")}</option>

            {#each MODELS as model (model)}
              <option value={model}>{model}</option>
            {/each}

            <option value="custom">{$t("chat.config.modelCustom")}</option>
          </select>

          <select
            class="select select-ghost select-xs h-6 w-auto max-w-24 pr-6 text-2xs"
            aria-label={$t("chat.config.effort")}
            title={$t("chat.config.effort")}
            value={device.chatEffort}
            onchange={e => update({ chatEffort: (e.currentTarget as HTMLSelectElement).value as ChatEffort })}
          >
            {#each EFFORTS as effort (effort)}
              <option value={effort}>{$t(`chat.effort.${effort || "default"}`)}</option>
            {/each}
          </select>

          <select
            class="select select-ghost select-xs h-6 w-auto max-w-24 pr-6 text-2xs"
            aria-label={$t("chat.config.permission")}
            title={$t("chat.config.permission")}
            value={device.chatPermission}
            onchange={e => setPermission((e.currentTarget as HTMLSelectElement).value as ChatPermission)}
          >
            {#each PERMISSIONS as mode (mode)}
              <option value={mode}>{$t(`chat.permission.${mode}`)}</option>
            {/each}
          </select>

          <span class="grow"></span>

          {#if stale}
            <button type="button" class="text-warning" onclick={restart}>
              {$t("chat.config.restart")}
            </button>
          {/if}

          {#if session && session.cost > 0}
            <span class="tabular-nums">${session.cost.toFixed(3)}</span>
          {/if}
        </div>
      </div>
    </section>
  {/if}

  {#each bubbles as b (b.id)}
    {@const p = at(b)}
    {@const mood = moodOf(b)}
    {@const isOpen = openId === b.id}
    {@const isHover = hovered?.id === b.id && !isOpen}
    {@const tip = isHover ? tipOf(b) : ""}
    {@const right = cornerOf(b).right}

    <div
      class={[
        "absolute transition-[left,top] duration-200 ease-out",
        dragged?.stack === b.stack && "transition-none",
      ]}
      style:left="{p.left}px"
      style:top="{p.top}px"
      style:width="{BUBBLE}px"
      style:height="{BUBBLE}px"
      style:--bubble={colorOf(b)}
      role="group"
      aria-label={titleOf(b)}
      onpointerenter={() => (hoverId = b.id)}
      onpointerleave={() => {
        if (hoverId === b.id) {
          hoverId = null
        }
      }}
    >
      <button
        type="button"
        class={[
          "bubble relative flex size-full cursor-grab items-center justify-center rounded-full border border-base-content/15 bg-base-100 transition-[filter] duration-200 ease-out hover:brightness-110 active:cursor-grabbing",
          `bubble-${mood}`,
          isOpen && "bubble-open",
          dragged?.id === b.id && moved && "brightness-110",
        ]}
        aria-label={titleOf(b)}
        aria-expanded={isOpen}
        onpointerdown={e => grab(e, b)}
        onpointermove={move}
        onpointerup={release}
        onpointercancel={release}
      >
        <Icon icon={claudeIcon} class="size-6 text-primary" />

        {#if mood === "unread"}
          <span class="bubble-dot" aria-hidden="true"></span>
        {/if}
      </button>

      {#if editing.on}
        {@const spotOpen = editing.open === EDIT_SPOT}

        <button
          type="button"
          class={[
            "absolute inset-0 z-40 rounded-full ring-2 ring-primary/70 transition-colors duration-150",
            spotOpen ? "bg-primary/25" : "bg-primary/10 hover:bg-primary/20",
          ]}
          aria-label={$t("edit.spots.bubble")}
          aria-haspopup="dialog"
          aria-expanded={spotOpen}
          onclick={() => (editing.open = spotOpen ? null : EDIT_SPOT)}
        >
          <span class="badge badge-primary badge-xs absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
            {$t("edit.spots.bubble")}
          </span>
        </button>

        {#if spotOpen}
          <div
            class={[
              "absolute bottom-0 z-50 w-80 rounded-box border border-base-content/10 bg-base-100/95 p-3 shadow-xl backdrop-blur-xl",
              right ? "right-full mr-3" : "left-full ml-3",
            ]}
            role="dialog"
            aria-label={$t("edit.spots.bubble")}
          >
            <div class="mb-2 text-xs font-semibold text-base-content/60">{$t("edit.spots.bubble")}</div>

            <div class="flex flex-col gap-1">
              <label class="flex flex-col gap-1 py-1 text-xs">
                <span class="flex justify-between">
                  <span>{$t("settings.rows.snapDistance")}</span>

                  <span class="text-base-content/60 tabular-nums">{device.chatSnap}%</span>
                </span>

                <input
                  type="range"
                  class="range range-primary range-xs"
                  min="0"
                  max="50"
                  step="1"
                  value={device.chatSnap}
                  oninput={e => (device = { ...device, chatSnap: Number(e.currentTarget.value) })}
                  onchange={e => patchDevice("chatSnap", Number(e.currentTarget.value))}
                />
              </label>

              <div class="flex items-center justify-between gap-3 py-1 text-xs">
                <span>{$t("settings.rows.chatHover")}</span>

                <Segmented value={device.chatHover} options={hoverOptions} onchange={v => patchDevice("chatHover", v)} />
              </div>

              <label class="flex items-center justify-between gap-3 py-1 text-xs">
                <span>{$t("settings.rows.chatMultiBubble")}</span>

                <input
                  type="checkbox"
                  class="toggle toggle-primary toggle-xs"
                  checked={device.chatMultiBubble}
                  onchange={e => patchDevice("chatMultiBubble", e.currentTarget.checked)}
                />
              </label>

              <label class="flex items-center justify-between gap-3 py-1 text-xs">
                <span>{$t("settings.rows.chatBubbleColors")}</span>

                <input
                  type="checkbox"
                  class="toggle toggle-primary toggle-xs"
                  checked={device.chatBubbleColors}
                  onchange={e => patchDevice("chatBubbleColors", e.currentTarget.checked)}
                />
              </label>
            </div>
          </div>
        {/if}
      {/if}

      {#if isHover && device.chatMultiBubble}
        <button
          type="button"
          class="bubble-plus"
          style:top="{-PLUS / 2}px"
          style:width="{PLUS}px"
          style:height="{PLUS}px"
          aria-label={$t("chat.newBubble")}
          title={$t("chat.newBubble")}
          onclick={() => spawn(b, true)}
        >
          <Icon icon="lucide:plus" class="size-3" />
        </button>

        <button
          type="button"
          class="bubble-plus"
          style:bottom="{-PLUS / 2}px"
          style:width="{PLUS}px"
          style:height="{PLUS}px"
          aria-label={$t("chat.newBubble")}
          title={$t("chat.newBubble")}
          onclick={() => spawn(b, false)}
        >
          <Icon icon="lucide:plus" class="size-3" />
        </button>
      {/if}

      {#if tip}
        <div
          bind:clientWidth={tipWidth}
          bind:clientHeight={tipHeight}
          class="pointer-events-none absolute z-10 w-max max-w-56 rounded-field border border-base-content/10 bg-base-100 px-2.5 py-1.5 text-xs shadow-lg"
          style:left={right ? "auto" : `${BUBBLE + TIP_GAP}px`}
          style:right={right ? `${BUBBLE + TIP_GAP}px` : "auto"}
          style:top="{BUBBLE / 2 - tipHeight / 2}px"
          role="tooltip"
        >
          <span class="line-clamp-3">{tip}</span>
        </div>
      {/if}
    </div>
  {/each}

  {#if dragging}
    <div
      class={[
        "absolute flex items-center justify-center rounded-full border transition-[transform,background-color] duration-150",
        overTarget
          ? "scale-125 border-error/40 bg-error/80 text-error-content"
          : "border-base-content/10 bg-base-100/80 text-base-content/70",
      ]}
      style:left="{targetX - TARGET / 2}px"
      style:top="{targetY - TARGET / 2}px"
      style:width="{TARGET}px"
      style:height="{TARGET}px"
      transition:scale={{ duration: 160, start: 0.4, easing: cubicOut }}
      aria-hidden="true"
    >
      <Icon icon="lucide:x" class="size-7" />
    </div>
  {/if}
</div>

<style>
  .bubble {
    box-shadow: inset 0 0 0 0.125rem color-mix(in oklch, var(--bubble) 40%, transparent);
  }

  .bubble-open {
    box-shadow: inset 0 0 0 0.125rem var(--bubble);
  }

  .bubble-other {
    box-shadow: inset 0 0 0 0.125rem color-mix(in oklch, var(--color-secondary) 55%, transparent);
  }

  .bubble-attention {
    animation: bubble-pulse 1.2s ease-in-out infinite;
  }

  .bubble-unread {
    box-shadow: inset 0 0 0 0.125rem var(--bubble);
    animation: bubble-nudge 0.6s ease-out 1;
  }

  .bubble-busy {
    box-shadow: none;
  }

  .bubble-busy::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: conic-gradient(from 0deg, transparent 0 62%, var(--bubble) 100%);
    mask: radial-gradient(farthest-side, transparent calc(100% - 0.1875rem), #000 calc(100% - 0.1875rem));
    animation: bubble-spin 1.4s linear infinite;
  }

  .bubble-dot {
    position: absolute;
    top: 0.3125rem;
    right: 0.3125rem;
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 9999px;
    background: var(--bubble);
    box-shadow: 0 0 0 0.125rem var(--color-base-100);
  }

  .bubble-swatch {
    width: 0.5rem;
    height: 0.5rem;
    flex-shrink: 0;
    border-radius: 9999px;
    background: var(--bubble);
  }

  .bubble-plus {
    position: absolute;
    left: 50%;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    translate: -50% 0;
    border-radius: 9999px;
    border: 1px solid color-mix(in oklch, var(--color-base-content) 15%, transparent);
    background: var(--color-base-100);
    color: color-mix(in oklch, var(--color-base-content) 70%, transparent);
    box-shadow: 0 0.0625rem 0.25rem color-mix(in oklch, var(--color-base-content) 15%, transparent);
  }

  .bubble-plus:hover {
    background: var(--bubble);
    color: var(--color-base-100);
  }

  .context-ring {
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: conic-gradient(var(--ring) var(--pct), transparent 0);
    mask: radial-gradient(farthest-side, transparent calc(100% - 0.1875rem), #000 calc(100% - 0.1875rem));
  }

  @keyframes bubble-spin {
    to {
      transform: rotate(1turn);
    }
  }

  @keyframes bubble-pulse {
    0%,
    100% {
      box-shadow: inset 0 0 0 0.125rem var(--color-warning);
    }

    50% {
      box-shadow: inset 0 0 0 0.375rem color-mix(in oklch, var(--color-warning) 35%, transparent);
    }
  }

  @keyframes bubble-nudge {
    0%,
    100% {
      translate: 0 0;
    }

    30% {
      translate: 0 -0.375rem;
    }

    60% {
      translate: 0 0.0625rem;
    }
  }
</style>
