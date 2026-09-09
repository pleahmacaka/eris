import {
  type DeviceSettings,
  defaultDevice,
  defaultProfile,
  type Profile,
  saveProfile,
} from "@eris/settings"
import { fromStore } from "svelte/store"
import { t } from "svelte-i18n"
import { type AppEntry, listApps, pinnedApps } from "$lib/native/apps"
import { type ClipEntry, clipboardHistory } from "$lib/native/clipboard"
import { hideWindow, listWindows, type WindowEntry } from "$lib/native/windows"
import { settingsLinks, systemCommands } from "./commands"
import { record, top } from "./frecency"
import { buildGroups, RECENT } from "./groups"
import { alignApps, mergeApps } from "./providers"
import { parseQuery, type Route } from "./search"
import type { Timer } from "./timers"
import type { Result, SecondaryAction } from "./types"

export const MENU_WIDTH = 208

type MenuAnchor = { index: number; x: number; y: number }

export class Launcher {
  profile = $state<Profile>(defaultProfile)

  device = $state<DeviceSettings>(defaultDevice)

  apps = $state<AppEntry[]>([])

  clips = $state<ClipEntry[]>([])

  pinned = $state<AppEntry[]>([])

  windows = $state<WindowEntry[]>([])

  timers = $state<Timer[]>([])

  icons = $state<Record<string, string>>({})

  query = $state("")

  cursor = $state(0)

  usage = $state(0)

  error = $state("")

  menu = $state<MenuAnchor | null>(null)

  menuCursor = $state(0)

  backdropMenu = $state(false)

  backdropMenuX = $state(0)

  backdropMenuY = $state(0)

  input = $state<HTMLInputElement>()

  list = $state<HTMLElement>()

  private i18n = fromStore(t)

  get t() {
    return this.i18n.current
  }

  commandRows = $derived.by(() => {
    void this.t

    return [...systemCommands(), ...settingsLinks()]
  })

  extrasById = $derived(new Map(this.commandRows.map(r => [r.id, r])))

  route = $derived.by((): Route => {
    const parsed = parseQuery(this.query)
    const { launcher } = this.profile
    const blocked =
      (parsed.mode === "todo" && !launcher.showTodos) ||
      (parsed.mode === "calc" && !launcher.calculator)

    return blocked ? { mode: "search", text: this.query.trim() } : parsed
  })

  clipMode = $derived(this.route.mode === "clip")

  dockPinned = $derived(new Set(this.device.pinnedApps))

  recentIds = $derived.by(() => {
    void this.usage

    return top(RECENT * 4)
  })

  groups = $derived(buildGroups(this))

  flat = $derived(this.groups.flatMap(g => g.items))

  active = $derived(Math.min(this.cursor, Math.max(this.flat.length - 1, 0)))

  compact = $derived(this.profile.appearance.density === "compact")

  menuItems = $derived.by((): SecondaryAction[] => {
    const item = this.menu ? this.flat[this.menu.index] : undefined

    return item
      ? [
          {
            label:
              item.kind === "clip"
                ? this.t("launcher.actions.paste")
                : this.t("launcher.actions.open"),
            run: item.action,
            stay: item.stay,
          },
          ...item.secondaryActions,
        ]
      : []
  })

  menuStyle = $derived.by(() => {
    if (!this.menu) {
      return ""
    }

    const maxLeft = window.innerWidth - MENU_WIDTH - 8
    const maxTop = window.innerHeight - (this.menuItems.length * 36 + 16) - 8
    const left = Math.max(8, Math.min(this.menu.x, maxLeft))
    const top = Math.max(8, Math.min(this.menu.y, maxTop))

    return `left:${left}px; top:${top}px; width:${MENU_WIDTH}px`
  })

  reset() {
    this.cursor = 0
    this.menu = null
    this.error = ""
  }

  setQuery(value: string) {
    this.query = value
    this.reset()
  }

  patchLauncher<K extends keyof Profile["launcher"]>(
    key: K,
    value: Profile["launcher"][K],
  ) {
    this.profile = {
      ...this.profile,
      launcher: { ...this.profile.launcher, [key]: value },
    }
    saveProfile($state.snapshot(this.profile)).catch(() => undefined)
  }

  async refreshApps() {
    const [all, taskbar] = await Promise.all([
      listApps().catch(() => [] as AppEntry[]),
      pinnedApps().catch(() => [] as AppEntry[]),
    ])

    this.apps = mergeApps([all, taskbar])
    this.pinned = alignApps(this.apps, taskbar)
  }

  async refreshWindows() {
    this.windows = await listWindows().catch(() => [])
  }

  async refreshClips() {
    this.clips = await clipboardHistory().catch(() => [])
  }

  refresh() {
    return Promise.all([
      this.refreshApps(),
      this.refreshWindows(),
      this.refreshClips(),
    ])
  }

  async hide() {
    this.menu = null
    await hideWindow("main")
    this.setQuery("")
  }

  async perform(item: Result, run: () => void | Promise<void>, stay = false) {
    this.menu = null

    try {
      await run()
    } catch (e) {
      this.error = this.t("launcher.couldNotOpen", {
        values: { title: item.title, error: String(e) },
      })

      return
    }

    const remembered =
      item.kind === "app" || item.kind === "command" || item.kind === "setting"

    if (remembered) {
      record(item.id).then(() => {
        this.usage += 1
      })
    }

    if (stay) {
      await this.refreshClips()

      return
    }

    await this.hide()
  }

  secondary(item: Result | undefined, id: "admin" | "location") {
    return item?.secondaryActions.find(a => a.id === id)
  }

  run(
    item: Result | undefined,
    variant: "open" | "admin" | "location" = "open",
  ) {
    if (!item) {
      return
    }

    const alt =
      variant === "admin"
        ? this.secondary(item, "admin")
        : variant === "location"
          ? this.secondary(item, "location")
          : undefined

    this.perform(item, alt?.run ?? item.action, alt?.stay ?? item.stay)
  }

  move(delta: number) {
    const count = this.flat.length

    if (count) {
      this.cursor = (((this.active + delta) % count) + count) % count
    }
  }

  jumpGroup(direction: 1 | -1) {
    if (this.groups.length < 2) {
      return
    }

    const current = this.groups.findIndex(
      g => this.active >= g.start && this.active < g.start + g.items.length,
    )
    const next = (current + direction + this.groups.length) % this.groups.length

    this.cursor = this.groups[next].start
  }

  openMenu(index: number, x: number, y: number) {
    this.cursor = index
    this.menuCursor = 0
    this.menu = { index, x, y }
  }

  openMenuAtActive() {
    const rect = this.list
      ?.querySelector(`[data-index="${this.active}"]`)
      ?.getBoundingClientRect()

    if (rect) {
      this.openMenu(this.active, rect.left + 56, rect.bottom)
    }
  }

  runMenu(action: SecondaryAction | undefined) {
    const item = this.menu ? this.flat[this.menu.index] : undefined

    if (item && action) {
      this.perform(item, action.run, action.stay)
    }
  }

  insertPrefix(prefix: string) {
    this.setQuery(prefix)
    this.input?.focus()
  }
}
