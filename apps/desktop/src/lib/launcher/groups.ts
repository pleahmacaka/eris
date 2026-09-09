import type { Profile } from "@eris/settings"
import type { AppEntry } from "$lib/native/apps"
import type { ClipEntry } from "$lib/native/clipboard"
import type { WindowEntry } from "$lib/native/windows"
import { looksLikeMath } from "./calc"
import { boost } from "./frecency"
import {
  appResult,
  calcResult,
  clearClipsResult,
  clipResults,
  emojiResults,
  newTimerResult,
  openResult,
  pendingTimerResult,
  runResult,
  todoResult,
  unitResult,
  webResult,
  windowResult,
} from "./providers"
import { groupResults, openTarget, type Route, rank } from "./search"
import { parseTimer, type Timer } from "./timers"
import type { Result, ResultGroup, ResultKind } from "./types"

export const RECENT = 6

export type GroupSource = {
  route: Route
  profile: Profile
  apps: AppEntry[]
  windows: WindowEntry[]
  pinned: AppEntry[]
  timers: Timer[]
  clips: ClipEntry[]
  icons: Record<string, string>
  dockPinned: Set<string>
  recentIds: string[]
  commandRows: Result[]
  extrasById: Map<string, Result>
  t: (key: string) => string
}

const limitFor = (s: GroupSource) => (kind: ResultKind) => {
  const max = s.profile.launcher.maxResults

  if (kind === "app" || kind === "clip" || kind === "emoji") {
    return max
  }

  if (kind === "timer") {
    return Math.max(4, max)
  }

  if (kind === "window" || kind === "command" || kind === "setting") {
    return Math.max(3, Math.ceil(max / 2))
  }

  return 2
}

const asApp = (s: GroupSource, a: AppEntry) =>
  appResult(a, s.icons[a.path], s.dockPinned.has(a.path))

const emptyGroups = (s: GroupSource): ResultGroup[] => {
  const { launcher } = s.profile
  const byId = new Map(s.apps.map(a => [`app:${a.id}`, a]))
  const recent = s.recentIds
    .flatMap(id => {
      const app = byId.get(id)

      if (app) {
        return [asApp(s, app)]
      }

      const extra = s.extrasById.get(id)

      return extra && launcher.showCommands ? [extra] : []
    })
    .slice(0, RECENT)
  const running = launcher.showWindows
    ? s.windows
        .slice(0, launcher.maxResults)
        .map(w => windowResult(w, s.icons[w.process]))
    : []
  const starred = recent.length
    ? recent
    : s.pinned.slice(0, RECENT).map(a => asApp(s, a))
  const groups: ResultGroup[] = []

  if (starred.length) {
    groups.push({
      kind: "app",
      label: recent.length
        ? s.t("launcher.sections.recent")
        : s.t("launcher.sections.pinned"),
      start: 0,
      items: starred,
    })
  }

  if (s.timers.length) {
    groups.push({
      kind: "timer",
      label: s.t("launcher.sections.timers"),
      start: 0,
      items: s.timers.map(t => pendingTimerResult(t)),
    })
  }

  if (running.length) {
    groups.push({
      kind: "window",
      label: s.t("launcher.sections.running"),
      start: 0,
      items: running,
    })
  }

  let start = 0

  for (const group of groups) {
    group.start = start
    start += group.items.length
  }

  return groups
}

export const buildGroups = (s: GroupSource): ResultGroup[] => {
  const { route } = s
  const { mode, text } = route
  const { launcher } = s.profile
  const limit = limitFor(s)

  if (mode === "run") {
    return text ? groupResults([runResult(text)], limit) : []
  }

  if (mode === "todo") {
    const todo = todoResult(text)

    return todo ? groupResults([todo], limit) : []
  }

  if (mode === "calc") {
    const outcome = unitResult(text) ?? calcResult(text)

    return outcome ? groupResults([outcome], limit) : []
  }

  if (route.mode === "timer") {
    const draft = parseTimer(text, route.kind)
    const rows = [
      ...(draft ? [newTimerResult(draft)] : []),
      ...s.timers.map(t => pendingTimerResult(t)),
    ]

    return rows.length ? groupResults(rows, limit) : []
  }

  if (mode === "emoji") {
    const rows = emojiResults(text)

    return rows.length ? groupResults(rows, limit) : []
  }

  if (mode === "clip") {
    const rows = clipResults(s.clips, text)

    return rows.length ? groupResults([...rows, clearClipsResult()], limit) : []
  }

  if (!text) {
    return emptyGroups(s)
  }

  const candidates: Result[] = [
    ...s.apps.map(a => asApp(s, a)),
    ...(launcher.showWindows
      ? s.windows.map(w => windowResult(w, s.icons[w.process]))
      : []),
    ...(launcher.showCommands ? s.commandRows : []),
  ]
  const extras: Result[] = []
  const conversion = launcher.calculator ? unitResult(text) : null
  const calc =
    launcher.calculator && !conversion && looksLikeMath(text)
      ? calcResult(text)
      : null
  const target = openTarget(text)

  if (conversion) {
    extras.push(conversion)
  }

  if (calc) {
    extras.push(calc)
  }

  if (target) {
    extras.push(openResult(target))
  }

  extras.push(webResult(text, launcher.webSearch))

  return groupResults([...rank(candidates, text, boost), ...extras], limit)
}
