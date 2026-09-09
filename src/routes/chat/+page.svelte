<script lang="ts">
  import Icon from "@iconify/svelte"
  import { listen } from "@tauri-apps/api/event"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { open as pickDirectory } from "@tauri-apps/plugin-dialog"
  import { cubicOut } from "svelte/easing"
  import { scale } from "svelte/transition"
  import { claudeIcon } from "$lib/claude-icon"
  import Markdown from "$lib/claude/Markdown.svelte"
  import {
    ClaudeSession,
    type Command,
    type PermissionMode,
    type Question,
  } from "$lib/claude/session.svelte"
  import { ensureDevice } from "$lib/device"
  import * as native from "$lib/native"
  import { onDevice } from "$lib/settings"

  const MENTION_DELAY = 150
  const RECENT_LIMIT = 8
  const STORAGE = "eris.chat"

  const appWindow = getCurrentWindow()

  let area = $state<native.ChatArea>({ width: 0, height: 0, monitors: [], home: 0 })
  let snap = $state(0.15)
  let previewing = $state<number | null>(null)
  let left = $state(0)
  let top = $state(0)
  let corner = $state({ right: true, bottom: true })
  let dragging = $state(false)
  let open = $state(false)
  let grabX = 0
  let grabY = 0
  let travel = 0

  const PERMISSIONS: { value: PermissionMode; label: string }[] = [
    { value: "default", label: "Ask" },
    { value: "acceptEdits", label: "Accept edits" },
    { value: "plan", label: "Plan" },
    { value: "bypassPermissions", label: "Bypass" },
  ]

  const LOCAL: Command[] = [
    { name: "clear", description: "Clear the conversation and start over" },
    { name: "resume", description: "Pick a previous session" },
    { name: "usage", description: "Show plan usage limits" },
  ]

  const stored = JSON.parse(localStorage.getItem(STORAGE) ?? "{}") as {
    folder?: string
    recent?: string[]
    permission?: PermissionMode
  }

  let permission = $state<PermissionMode>(stored.permission ?? "default")
  let folder = $state(stored.folder ?? "")
  let recent = $state<string[]>(stored.recent ?? [])
  let session = $state<ClaudeSession | null>(null)
  let cli = $state<string | null | undefined>(undefined)
  let history = $state<native.Transcript[]>([])
  let historyOpen = $state(false)
  let draft = $state("")
  let input = $state<HTMLTextAreaElement>()
  let thread = $state<HTMLElement>()
  let mentions = $state<native.FileEntry[]>([])
  let picked = $state<Record<string, string[]>>({})
  let unit = $state(16)
  let panel = $state<HTMLElement>()
  let placed = false

  const px = (rem: number) => Math.round(rem * unit)

  const BUBBLE = $derived(px(3.5))

  // ponytail: fixed panel size, add resizing when threads need more room
  const PANEL_WIDTH = $derived(px(27.5))

  const PANEL_HEIGHT = $derived(px(40))

  const GAP = $derived(px(0.75))

  const EDGE = $derived(px(0.5))

  const TARGET = $derived(px(4))

  const TARGET_BOTTOM = $derived(px(3.5))

  const CATCH = $derived(px(7.5))

  const SLOP = $derived(px(0.2))

  const panelRadius = $derived(
    panel ? Number.parseFloat(getComputedStyle(panel).borderTopLeftRadius) : px(1),
  )

  const cwd = $derived(folder || null)

  const title = "Claude"

  const folderName = $derived(
    folder.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? "",
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

  const screen = $derived(monitorAt(left + BUBBLE / 2, top + BUBBLE / 2))

  const targetX = $derived(screen.x + screen.width / 2)
  const targetY = $derived(screen.y + screen.height - TARGET_BOTTOM - TARGET / 2)

  const overTarget = $derived(
    dragging &&
      Math.hypot(left + BUBBLE / 2 - targetX, top + BUBBLE / 2 - targetY) <
        CATCH,
  )

  const panelLeft = $derived(
    Math.min(
      Math.max(screen.x + EDGE, corner.right ? left - GAP - PANEL_WIDTH : left + BUBBLE + GAP),
      screen.x + screen.width - PANEL_WIDTH - EDGE,
    ),
  )

  const panelTop = $derived(
    Math.min(
      Math.max(screen.y + EDGE, corner.bottom ? top + BUBBLE - PANEL_HEIGHT : top),
      screen.y + screen.height - PANEL_HEIGHT - EDGE,
    ),
  )

  const origin = $derived(
    `${corner.right ? "right" : "left"} ${corner.bottom ? "bottom" : "top"}`,
  )

  const frame = $derived.by(() => {
    if (dragging || previewing !== null) {
      return { x: 0, y: 0, width: area.width, height: area.height }
    }

    let x0 = left
    let y0 = top
    let x1 = left + BUBBLE
    let y1 = top + BUBBLE

    if (open) {
      x0 = Math.min(x0, panelLeft)
      y0 = Math.min(y0, panelTop)
      x1 = Math.max(x1, panelLeft + PANEL_WIDTH)
      y1 = Math.max(y1, panelTop + PANEL_HEIGHT)
    }

    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
  })

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

  const place = () => {
    const home = area.monitors[area.home] ?? whole

    left = corner.right ? home.x + home.width - BUBBLE - EDGE : home.x + EDGE
    top = corner.bottom ? home.y + home.height - BUBBLE - EDGE : home.y + EDGE
  }

  const settle = () => {
    const centerX = left + BUBBLE / 2
    const centerY = top + BUBBLE / 2
    const m = monitorAt(centerX, centerY)
    const minLeft = m.x + EDGE
    const minTop = m.y + EDGE
    const maxLeft = m.x + m.width - BUBBLE - EDGE
    const maxTop = m.y + m.height - BUBBLE - EDGE
    const fromLeft = (centerX - m.x) / m.width
    const fromTop = (centerY - m.y) / m.height

    corner = { right: fromLeft >= 0.5, bottom: fromTop >= 0.5 }

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

    left = Math.min(Math.max(minLeft, left), maxLeft)
    top = Math.min(Math.max(minTop, top), maxTop)
  }

  const load = async () => {
    unit = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)

    const next = await native.chatArea().catch(() => null)

    if (!next) {
      return
    }

    area = next

    if (placed) {
      settle()
    } else {
      place()
      placed = true
    }
  }

  const remember = () => {
    if (folder && !recent.includes(folder)) {
      recent = [folder, ...recent].slice(0, RECENT_LIMIT)
    }

    localStorage.setItem(
      STORAGE,
      JSON.stringify({ folder, recent, permission }),
    )
  }

  const setPermission = async (next: PermissionMode) => {
    permission = next
    remember()
    await session?.setPermissionMode(next)
  }

  const fresh = async (resume: string | null = null) => {
    await session?.stop()

    const next = new ClaudeSession()

    session = next
    historyOpen = false
    picked = {}

    const past = resume ? await native.claudeTranscript(cwd, resume).catch(() => []) : []

    await next
      .start({
        cwd,
        resume,
        plain: !folder,
        permissionMode: permission,
        history: past,
      })
      .catch(e => {
        next.error = String(e)
      })
  }

  const loadHistory = async () => {
    history = await native.claudeSessions(cwd).catch(() => [])
    historyOpen = true
  }

  const chooseFolder = async () => {
    const choice = await pickDirectory({
      directory: true,
      defaultPath: folder || undefined,
    }).catch(() => null)

    if (typeof choice !== "string") {
      return
    }

    folder = choice
    remember()
    await fresh()
  }

  const useFolder = async (path: string) => {
    folder = path
    remember()
    await fresh()
  }

  const closeFolder = async () => {
    folder = ""
    remember()
    await fresh()
  }

  const showUsage = async () => {
    if (!session) {
      await fresh()
    }

    const fallback = session?.usage
      ? null
      : await native.claudeUsage(null).catch(() => null)

    session?.showUsage(fallback)
  }

  const runLocal = async (text: string) => {
    const name = text.slice(1).split(" ")[0]

    if (name === "clear") {
      await fresh()
    } else if (name === "resume") {
      await loadHistory()
    } else if (name === "usage") {
      await showUsage()
    } else {
      return false
    }

    return true
  }

  const send = async () => {
    const text = draft.trim()

    if (!text || session?.busy) {
      return
    }

    draft = ""

    if (text.startsWith("/") && (await runLocal(text))) {
      return
    }

    if (!session) {
      await fresh()
    }

    await session?.send(text)
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
    new Date(seconds * 1000).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })

  $effect(() => {
    document.documentElement.dataset.surface = "overlay"
    load()
    native.claudeWhich().then(path => {
      cli = path
    })

    ensureDevice().then(d => {
      snap = d.chatSnap / 100
    })

    const stops = [
      native.onWindowShown("chat", load),
      native.onChatToggle(() => toggle()),
      onDevice(d => {
        snap = d.chatSnap / 100
      }),
      listen<{ percent: number; on: boolean }>("chat-snap-preview", e => {
        previewing = e.payload.on ? e.payload.percent : null
      }),
    ]

    return () => {
      for (const stop of stops) {
        stop.then(off => off()).catch(() => undefined)
      }

      session?.stop()
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
    if (area.width === 0) {
      return
    }

    const box = (
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    ) => [x - frame.x, y - frame.y, x - frame.x + width, y - frame.y + height, radius]

    const rects =
      previewing !== null
        ? [[0, 0, frame.width, frame.height, 0]]
        : [box(left, top, BUBBLE, BUBBLE, BUBBLE / 2)]

    if (open && !dragging && previewing === null) {
      rects.push(box(panelLeft, panelTop, PANEL_WIDTH, PANEL_HEIGHT, panelRadius))
    }

    if (dragging) {
      rects.push(
        box(
          targetX - TARGET / 2,
          targetY - TARGET / 2,
          TARGET,
          TARGET,
          TARGET / 2,
        ),
      )
    }

    native
      .chatFrame([frame.x, frame.y, frame.width, frame.height], rects)
      .catch(() => undefined)
  })

  const hide = () => {
    open = false
    native.hideWindow("chat").catch(() => undefined)
  }

  const toggle = () => {
    open = !open

    if (open) {
      appWindow.setFocus().catch(() => undefined)
      queueMicrotask(() => input?.focus())

      if (!session && cli !== null) {
        fresh()
      }
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      if (historyOpen || commands.length > 0 || mentions.length > 0) {
        historyOpen = false
        mentions = []
        draft = commands.length > 0 ? "" : draft

        return
      }

      open = false
    }
  }

  const grab = (e: PointerEvent) => {
    if (e.button !== 0) {
      return
    }

    grabX = e.clientX + frame.x - left
    grabY = e.clientY + frame.y - top
    travel = 0
    dragging = true
    capture(e, true)
  }

  const move = (e: PointerEvent) => {
    if (!dragging) {
      return
    }

    const nextLeft = e.clientX + frame.x - grabX
    const nextTop = e.clientY + frame.y - grabY

    travel += Math.abs(nextLeft - left) + Math.abs(nextTop - top)
    left = nextLeft
    top = nextTop
  }

  const release = (e: PointerEvent) => {
    if (!dragging) {
      return
    }

    capture(e, false)

    const dropped = overTarget
    const tapped = travel < SLOP

    dragging = false

    if (dropped) {
      hide()

      return
    }

    if (tapped) {
      place()
      toggle()

      return
    }

    settle()
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
</script>

<svelte:window {onkeydown} />

<div class="absolute" style:left="{-frame.x}px" style:top="{-frame.y}px">
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

  {#if open && !dragging}
    <section
      bind:this={panel}
      class="absolute isolate flex flex-col overflow-hidden rounded-box border border-base-content/10 bg-base-100"
      style:left="{panelLeft}px"
      style:top="{panelTop}px"
      style:width="{PANEL_WIDTH}px"
      style:height="{PANEL_HEIGHT}px"
      style:transform-origin={origin}
      transition:scale={{ duration: 220, start: 0.88, easing: cubicOut }}
      aria-label={title}
    >
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-primary/15 to-transparent"
        aria-hidden="true"
      ></div>

      <header class="flex shrink-0 items-center gap-1 px-4 pt-3 pb-2">
        <span class="text-sm font-medium tracking-tight">{title}</span>

        {#if folder}
          <span
            class="inline-flex max-w-40 items-center rounded-field bg-base-content/5 pl-2 text-xs"
          >
            <Icon icon="lucide:folder" class="size-3.5 shrink-0" />

            <button
              type="button"
              class="truncate px-1 py-1"
              title={folder}
              onclick={chooseFolder}
            >
              {folderName}
            </button>

            <button
              type="button"
              class="btn btn-circle btn-ghost btn-xs"
              aria-label="Close folder"
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

            Open folder
          </button>
        {/if}

        <select
          class="select select-ghost select-xs w-auto max-w-28 text-xs"
          aria-label="Permission mode"
          title="Permission mode"
          value={permission}
          onchange={e => setPermission((e.currentTarget as HTMLSelectElement).value as PermissionMode)}
        >
          {#each PERMISSIONS as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>

        <span class="grow"></span>

        <button
          type="button"
          class="btn btn-circle btn-ghost btn-xs"
          title="History"
          aria-label="Previous chats"
          onclick={loadHistory}
        >
          <Icon icon="lucide:history" class="size-4" />
        </button>

        <button
          type="button"
          class="btn btn-circle btn-ghost btn-xs"
          title="New chat"
          aria-label="New chat"
          onclick={() => fresh()}
        >
          <Icon icon="lucide:plus" class="size-4" />
        </button>

        <button
          type="button"
          class="btn btn-circle btn-ghost btn-xs"
          aria-label="Close"
          onclick={() => (open = false)}
        >
          <Icon icon="lucide:x" class="size-4" />
        </button>
      </header>

      {#if historyOpen}
        <div class="flex min-h-0 grow flex-col px-3 pb-3">
          <div class="flex items-center justify-between px-2 pb-1">
            <p class="text-xs text-base-content/50">{cwd ?? "Home"}</p>

            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onclick={() => (historyOpen = false)}
            >
              <Icon icon="lucide:arrow-left" class="size-3.5" />

              Back
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
                  <span class="line-clamp-1 text-sm">
                    {session.turns[0].blocks[0]?.kind === "text" ? session.turns[0].blocks[0].text : "Current chat"}
                  </span>

                  <span class="text-2xs text-primary">진행 중</span>
                </button>
              </li>
            {/if}

            {#each history.filter(item => item.id !== session?.info.id) as item (item.id)}
              <li>
                <button
                  type="button"
                  class="flex w-full flex-col items-start gap-0.5 rounded-field px-2 py-1.5 text-left hover:bg-base-content/10"
                  onclick={() => fresh(item.id)}
                >
                  <span class="line-clamp-1 text-sm">{item.title || "Untitled"}</span>

                  <span class="text-2xs text-base-content/50">
                    {item.messages} messages, {when(item.modified)}
                  </span>
                </button>
              </li>
            {:else}
              <li class="px-2 py-4 text-sm text-base-content/50">기록 없음</li>
            {/each}
          </ul>

          {#if recent.length > 0}
            <p class="px-2 pt-2 pb-1 text-xs text-base-content/50">Recent folders</p>

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

              <p>Claude Code CLI 미설치</p>

              <code class="rounded-field bg-base-content/10 px-2 py-1 text-xs"
                >npm install -g @anthropic-ai/claude-code</code
              >
            </div>
          {:else if !session || session.turns.length === 0}
            <div class="m-auto flex flex-col items-center gap-3 text-center">
              <Icon icon={claudeIcon} class="size-8 text-primary/70" />

              <p class="text-sm text-base-content/50">
                {folder ? "코드 작업을 요청하세요" : "무엇이든 물어보세요"}
              </p>

              <p class="text-xs text-base-content/40">
                {folder ? "/ 명령, @ 파일" : "폴더를 열어 코드 작업을 시작하세요"}
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
                      {#each [["5시간", block.usage.fiveHour], ["주간", block.usage.sevenDay]] as const as [name, window] (name)}
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
                                {new Date(window.resetsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} 초기화
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
                  Deny
                </button>

                {#if permission.suggestions}
                  <button type="button" class="btn btn-ghost btn-xs" onclick={() => session?.allow(true)}>
                    Always
                  </button>
                {/if}

                <button type="button" class="btn btn-primary btn-xs" onclick={() => session?.allow(false)}>
                  Allow
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
                Submit
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

      <div class={["relative shrink-0 p-3", historyOpen && "hidden"]}>
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

        <div
          class="flex items-end gap-2 rounded-box border border-base-content/10 bg-base-100/70 py-1.5 pr-1.5 pl-4"
        >
          <textarea
            bind:this={input}
            bind:value={draft}
            onkeydown={compose}
            rows="1"
            placeholder={session?.busy ? "응답 중" : "메시지 입력"}
            class="max-h-28 min-h-8 grow resize-none bg-transparent py-1 text-sm outline-none placeholder:text-base-content/35"
          ></textarea>

          {#if session?.busy}
            <button
              type="button"
              class="btn btn-circle btn-ghost btn-sm"
              aria-label="Stop"
              onclick={() => session?.interrupt()}
            >
              <Icon icon="lucide:square" class="size-4" />
            </button>
          {:else}
            <button
              type="button"
              class="btn btn-circle btn-primary btn-sm"
              aria-label="Send"
              disabled={!draft.trim() || cli === null}
              onclick={send}
            >
              <Icon icon="lucide:arrow-up" class="size-4" />
            </button>
          {/if}
        </div>

        {#if session && (session.info.model || session.cost > 0)}
          <p class="mt-1 flex justify-between px-2 text-3xs text-base-content/40">
            <span class="truncate">{session.info.model}</span>

            <span class="tabular-nums">${session.cost.toFixed(3)}</span>
          </p>
        {/if}
      </div>
    </section>
  {/if}

  <button
    type="button"
    class={[
      "absolute flex cursor-grab items-center justify-center rounded-full border border-base-content/15 bg-base-100 transition-[left,top,filter] duration-200 ease-out hover:brightness-110 active:cursor-grabbing",
      dragging && "transition-none brightness-110",
      open && "ring-2 ring-primary/40",
    ]}
    style:left="{left}px"
    style:top="{top}px"
    style:width="{BUBBLE}px"
    style:height="{BUBBLE}px"
    aria-label="Chat bubble"
    aria-expanded={open}
    onpointerdown={grab}
    onpointermove={move}
    onpointerup={release}
    onpointercancel={release}
  >
    <Icon icon={claudeIcon} class="size-6 text-primary" />
  </button>

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
