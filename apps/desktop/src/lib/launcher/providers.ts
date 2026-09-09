import { currentLocale, tr } from "@eris/i18n"
import type { WebSearchEngine } from "@eris/settings"
import { newId, todos } from "../data/store"
import { dueLabel, parseQuickAdd } from "../data/todo"
import type { Todo } from "../data/types"
import { toggleDockPin } from "../dock/dock.svelte"
import {
  type AppEntry,
  activateWindow,
  type ClipEntry,
  clipboardClear,
  clipboardCopy,
  clipboardPaste,
  clipboardPin,
  clipboardRemove,
  closeWindow,
  launchApp,
  openLocation,
  openUrl,
  runCommand,
  type WindowEntry,
} from "../native"
import { evaluate, formatNumber, plainNumber } from "./calc"
import { matchEmoji } from "./emoji"
import {
  addTimer,
  cancelTimer,
  formatClock,
  remaining,
  type Timer,
  type TimerKind,
} from "./timers"
import type { Result } from "./types"
import { convert } from "./units"

const FALLBACK_ICON = "lucide:app-window"

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path

const appKey = (app: AppEntry) => app.name.trim().toLowerCase()

export const mergeApps = (lists: AppEntry[][]) => {
  const seen = new Set<string>()
  const merged: AppEntry[] = []

  for (const app of lists.flat()) {
    const key = appKey(app)

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    merged.push(app)
  }

  return merged
}

export const alignApps = (apps: AppEntry[], list: AppEntry[]) => {
  const byName = new Map(apps.map(a => [appKey(a), a]))

  return mergeApps([list]).map(a => byName.get(appKey(a)) ?? a)
}

export const appResult = (
  app: AppEntry,
  icon?: string,
  dockPinned = false,
): Result => ({
  id: `app:${app.id}`,
  kind: "app",
  title: app.name,
  subtitle: app.subtitle,
  icon: icon || FALLBACK_ICON,
  iconPath: app.path,
  action: () => launchApp(app.path),
  secondaryActions: [
    {
      id: "admin",
      label: tr("launcher.actions.admin"),
      run: () => launchApp(app.path, true),
    },
    ...(app.kind === "store"
      ? []
      : [
          {
            id: "location" as const,
            label: tr("launcher.actions.location"),
            run: () => openLocation(app.path),
          },
        ]),
    {
      label: dockPinned
        ? tr("launcher.actions.unpinDock")
        : tr("launcher.actions.pinDock"),
      run: () => toggleDockPin(app.path),
    },
  ],
  score: 0,
})

export const windowResult = (entry: WindowEntry, icon?: string): Result => ({
  id: `window:${entry.hwnd}`,
  kind: "window",
  title: entry.title,
  subtitle: fileName(entry.process),
  icon: icon || FALLBACK_ICON,
  iconPath: entry.process,
  chips: entry.minimized ? [tr("launcher.chips.minimized")] : undefined,
  action: () => activateWindow(entry.hwnd),
  secondaryActions: [
    {
      label: tr("launcher.actions.closeWindow"),
      run: () => closeWindow(entry.hwnd),
    },
  ],
  score: 0,
})

export const calcResult = (expression: string): Result | null => {
  const outcome = evaluate(expression)

  if (!outcome) {
    return null
  }

  const base = {
    id: "calc",
    kind: "calc" as const,
    subtitle: expression.trim(),
    icon: "lucide:calculator",
    secondaryActions: [],
    score: 2000,
  }

  if ("error" in outcome) {
    return {
      ...base,
      title: tr(`launcher.calcErrors.${outcome.error}`),
      action: () => undefined,
      stay: true,
    }
  }

  return {
    ...base,
    title: formatNumber(outcome.value),
    chips: [tr("launcher.chips.enterCopies")],
    action: () => navigator.clipboard.writeText(plainNumber(outcome.value)),
  }
}

export const unitResult = (expression: string): Result | null => {
  const converted = convert(expression)

  if (!converted) {
    return null
  }

  return {
    id: "unit",
    kind: "unit",
    title: converted.formatted,
    subtitle: expression.trim(),
    icon: "lucide:arrow-left-right",
    chips: [tr("launcher.chips.enterCopies")],
    action: () => navigator.clipboard.writeText(converted.formatted),
    secondaryActions: [],
    score: 2100,
  }
}

export const emojiResults = (query: string): Result[] =>
  matchEmoji(query).map(match => ({
    id: `emoji:${match.char}`,
    kind: "emoji",
    title: match.name,
    subtitle: match.char,
    icon: match.char,
    chips: [tr("launcher.chips.enterCopies")],
    action: () => navigator.clipboard.writeText(match.char),
    secondaryActions: [],
    score: match.score,
  }))

export const newTimerResult = (draft: Omit<Timer, "id">): Result => ({
  id: "timer:new",
  kind: "timer",
  title: tr(
    draft.kind === "alarm"
      ? "launcher.timer.setAlarm"
      : "launcher.timer.startTimer",
    {
      label: draft.label,
    },
  ),
  subtitle: tr("launcher.timer.firesAt", { time: formatClock(draft.fireAt) }),
  icon: draft.kind === "alarm" ? "lucide:alarm-clock" : "lucide:timer",
  action: () => addTimer(draft),
  secondaryActions: [],
  score: 2000,
})

export const pendingTimerResult = (timer: Timer, now = Date.now()): Result => ({
  id: `timer:${timer.id}`,
  kind: "timer",
  title: timer.label,
  subtitle: tr("launcher.timer.left", {
    remaining: remaining(timer, now),
    time: formatClock(timer.fireAt),
  }),
  icon: timer.kind === "alarm" ? "lucide:alarm-clock" : "lucide:hourglass",
  action: () => undefined,
  secondaryActions: [
    {
      id: "cancel",
      label: tr("launcher.actions.cancel"),
      run: () => cancelTimer(timer.id),
      stay: true,
    },
  ],
  stay: true,
  score: Math.max(1, 1999 - Math.floor((timer.fireAt - now) / 1000)),
})

export const timerKindLabel = (kind: TimerKind) =>
  tr(kind === "alarm" ? "launcher.timer.alarm" : "launcher.timer.timer")

const buildTodo = (parsed: Partial<Todo>, title: string): Todo => {
  const now = Date.now()

  return {
    id: newId(),
    title,
    notes: "",
    done: false,
    doneAt: null,
    priority: parsed.priority ?? 0,
    due: parsed.due ?? null,
    tags: parsed.tags ?? [],
    order: now,
    createdAt: now,
    updatedAt: now,
  }
}

export const todoResult = (text: string): Result | null => {
  const parsed = parseQuickAdd(text)
  const title = parsed.title?.trim()

  if (!title) {
    return null
  }

  const todo = buildTodo(parsed, title)
  const chips = [
    ...(todo.due ? [dueLabel(todo)] : []),
    ...(todo.priority
      ? [tr("launcher.chips.priority", { level: todo.priority })]
      : []),
    ...todo.tags.map(tag => `#${tag}`),
  ]

  return {
    id: "todo",
    kind: "todo",
    title: tr("launcher.todo.add", { title }),
    subtitle: tr("launcher.todo.saves"),
    icon: "lucide:list-plus",
    chips,
    action: async () => {
      await todos.put(todo)
    },
    secondaryActions: [],
    score: 2000,
  }
}

const ENGINES: Record<WebSearchEngine, { name: string; url: string }> = {
  google: { name: "Google", url: "https://www.google.com/search?q=" },
  duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  bing: { name: "Bing", url: "https://www.bing.com/search?q=" },
  naver: {
    name: "Naver",
    url: "https://search.naver.com/search.naver?query=",
  },
}

export const webResult = (query: string, engine: WebSearchEngine): Result => {
  const { name, url } = ENGINES[engine]

  return {
    id: "web",
    kind: "web",
    title: tr("launcher.web.search", { query }),
    subtitle: name,
    icon: "lucide:globe",
    action: () => openUrl(url + encodeURIComponent(query)),
    secondaryActions: [],
    score: 0,
  }
}

export const runResult = (command: string): Result => ({
  id: "run",
  kind: "run",
  title: tr("launcher.run.title", { command }),
  subtitle: tr("launcher.run.subtitle"),
  icon: "lucide:terminal",
  action: () => runCommand(command),
  secondaryActions: [],
  score: 2000,
})

export const openResult = (target: string): Result => {
  const link = /^https?:\/\//i.test(target)

  return {
    id: "open",
    kind: "run",
    title: tr("launcher.open.title", { target }),
    subtitle: link ? tr("launcher.open.link") : tr("launcher.open.path"),
    icon: link ? "lucide:external-link" : "lucide:folder-open",
    action: () => openUrl(target),
    secondaryActions: [],
    score: 700,
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
]

export const relativeTime = (at: number, now = Date.now()) => {
  const gap = now - at
  const unit = UNITS.find(([, ms]) => gap >= ms)

  return unit
    ? new Intl.RelativeTimeFormat(currentLocale(), { numeric: "auto" }).format(
        -Math.floor(gap / unit[1]),
        unit[0],
      )
    : tr("launcher.clip.justNow")
}

const clipTitle = (text: string) =>
  text.trim().split("\n")[0].split(/\s+/).join(" ").slice(0, 120)

const clipResult = (entry: ClipEntry, score: number): Result => {
  const lines = entry.text.trim().split("\n").length
  const when = relativeTime(entry.at)
  const size = `${tr("launcher.clip.lines", { count: lines })} · ${tr("launcher.clip.chars", { count: entry.text.length })}`

  return {
    id: `clip:${entry.id}`,
    kind: "clip",
    title: clipTitle(entry.text) || tr("launcher.clip.whitespace"),
    subtitle: `${when} · ${size}`,
    icon: entry.pinned ? "lucide:pin" : "lucide:clipboard",
    action: () => clipboardPaste(entry.id),
    secondaryActions: [
      {
        label: tr("launcher.actions.copyOnly"),
        run: () => clipboardCopy(entry.id),
      },
      {
        label: entry.pinned
          ? tr("launcher.actions.unpin")
          : tr("launcher.actions.pin"),
        run: () => clipboardPin(entry.id, !entry.pinned),
        stay: true,
      },
      {
        label: tr("launcher.actions.delete"),
        run: () => clipboardRemove(entry.id),
        stay: true,
      },
    ],
    score,
  }
}

export const clipResults = (entries: ClipEntry[], query: string): Result[] => {
  const needle = query.toLowerCase()
  const matched = entries
    .filter(e => e.text.toLowerCase().includes(needle))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at - a.at)

  return matched.map((e, i) => clipResult(e, matched.length - i))
}

export const clearClipsResult = (): Result => ({
  id: "clip:clear",
  kind: "command",
  title: tr("launcher.clip.clearHistory"),
  subtitle: tr("launcher.clip.keepsPinned"),
  icon: "lucide:trash-2",
  action: clipboardClear,
  secondaryActions: [],
  stay: true,
  score: 0,
})
