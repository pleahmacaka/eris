<script lang="ts">
  import Icon from "@iconify/svelte"
  import { listen } from "@tauri-apps/api/event"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { appIcon } from "$lib/apps"
  import { ensureDevice } from "$lib/device"
  import { looksLikeMath } from "$lib/launcher/calc"
  import { settingsLinks, systemCommands } from "$lib/launcher/commands"
  import { boost, loadFrecency, record, top } from "$lib/launcher/frecency"
  import {
    ADMIN,
    alignApps,
    appResult,
    calcResult,
    clearClipsResult,
    clipResults,
    emojiResults,
    LOCATION,
    mergeApps,
    newTimerResult,
    openResult,
    pendingTimerResult,
    runResult,
    timerKindLabel,
    todoResult,
    unitResult,
    webResult,
    windowResult,
  } from "$lib/launcher/providers"
  import {
    groupResults,
    openTarget,
    parseQuery,
    rank,
    type Route,
  } from "$lib/launcher/search"
  import {
    parseTimer,
    subscribeTimers,
    type Timer,
  } from "$lib/launcher/timers"
  import {
    kindLabels,
    type Result,
    type ResultGroup,
    type ResultKind,
    type SecondaryAction,
  } from "$lib/launcher/types"
  import {
    type AppEntry,
    type ClipEntry,
    clipboardHistory,
    hideWindow,
    listApps,
    listWindows,
    onWindowShown,
    pinnedApps,
    showWindow,
    type WindowEntry,
  } from "$lib/native"
  import ContextMenu from "$lib/ui/ContextMenu.svelte"
  import type { MenuItem } from "$lib/ui/menu"
  import {
    type DeviceSettings,
    defaultDevice,
    defaultProfile,
    loadProfile,
    onDevice,
    onProfile,
    type Profile,
    saveDevice,
  } from "$lib/settings"

  const appWindow = getCurrentWindow()
  const PAGE = 5
  const RECENT = 6
  const MENU_WIDTH = 208
  const extrasById = new Map(
    [...systemCommands, ...settingsLinks].map(r => [r.id, r]),
  )

  let profile = $state<Profile>(defaultProfile)
  let device = $state<DeviceSettings>(defaultDevice)
  let apps = $state<AppEntry[]>([])
  let clips = $state<ClipEntry[]>([])
  let pinned = $state<AppEntry[]>([])
  let windows = $state<WindowEntry[]>([])
  let timers = $state<Timer[]>([])
  let icons = $state<Record<string, string>>({})
  let query = $state("")
  let cursor = $state(0)
  let usage = $state(0)
  let error = $state("")
  let menu = $state<{ index: number; x: number; y: number } | null>(null)
  let menuCursor = $state(0)
  let input = $state<HTMLInputElement>()
  let list = $state<HTMLElement>()

  const reset = () => {
    cursor = 0
    menu = null
    error = ""
  }

  const setQuery = (value: string) => {
    query = value
    reset()
  }

  const refreshApps = async () => {
    const [all, taskbar] = await Promise.all([
      listApps().catch(() => [] as AppEntry[]),
      pinnedApps().catch(() => [] as AppEntry[]),
    ])

    apps = mergeApps([all, taskbar])
    pinned = alignApps(apps, taskbar)
  }

  const refreshWindows = async () => {
    windows = await listWindows().catch(() => [])
  }

  const refreshClips = async () => {
    clips = await clipboardHistory().catch(() => [])
  }

  const refresh = () =>
    Promise.all([refreshApps(), refreshWindows(), refreshClips()])

  $effect(() => {
    ensureDevice()
      .then(d => (device = d))
      .catch(() => undefined)
    loadFrecency().then(() => (usage += 1))
    loadProfile().then(p => (profile = p))
    refresh()

    const stopTimers = subscribeTimers(items => (timers = items))

    const stops = [
      onProfile(p => (profile = p)),
      onDevice(d => (device = d)),
      onWindowShown("main", () => {
        setQuery("")
        usage += 1
        refresh()
        input?.focus()
      }),
      listen<string>("launcher-query", e => {
        setQuery(e.payload)
        input?.focus()
      }),
    ]

    return () => {
      stopTimers()

      for (const stop of stops) {
        stop.then(fn => fn())
      }
    }
  })

  $effect(() => {
    input?.focus()
  })

  const route = $derived.by((): Route => {
    const parsed = parseQuery(query)
    const { launcher } = profile
    const blocked =
      (parsed.mode === "todo" && !launcher.showTodos) ||
      (parsed.mode === "calc" && !launcher.calculator)

    return blocked ? { mode: "search", text: query.trim() } : parsed
  })

  const clipMode = $derived(route.mode === "clip")
  const enterLabel = $derived(
    route.mode === "clip"
      ? "Paste"
      : route.mode === "emoji"
        ? "Copy"
        : "Open",
  )
  const dockPinned = $derived(new Set(device.pinnedApps))

  $effect(() => {
    if (clipMode) {
      refreshClips()
    }
  })

  const limit = (kind: ResultKind) => {
    const max = profile.launcher.maxResults

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

  const recentIds = $derived.by(() => {
    void usage

    return top(RECENT * 4)
  })

  const asApp = (a: AppEntry) =>
    appResult(a, icons[a.path], dockPinned.has(a.path))

  const emptyGroups = (): ResultGroup[] => {
    const byId = new Map(apps.map(a => [`app:${a.id}`, a]))
    const recent = recentIds
      .flatMap(id => {
        const app = byId.get(id)

        if (app) {
          return [asApp(app)]
        }

        const extra = extrasById.get(id)

        return extra && profile.launcher.showCommands ? [extra] : []
      })
      .slice(0, RECENT)
    const running = profile.launcher.showWindows
      ? windows
          .slice(0, profile.launcher.maxResults)
          .map(w => windowResult(w, icons[w.process]))
      : []
    const starred = recent.length
      ? recent
      : pinned.slice(0, RECENT).map(asApp)
    const groups: ResultGroup[] = []

    if (starred.length) {
      groups.push({
        kind: "app",
        label: recent.length ? "Recent" : "Pinned",
        start: 0,
        items: starred,
      })
    }

    if (timers.length) {
      groups.push({
        kind: "timer",
        label: "Timers",
        start: 0,
        items: timers.map(t => pendingTimerResult(t)),
      })
    }

    if (running.length) {
      groups.push({
        kind: "window",
        label: "Running",
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

  const groups = $derived.by((): ResultGroup[] => {
    const { mode, text } = route
    const { launcher } = profile

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
        ...timers.map(t => pendingTimerResult(t)),
      ]

      return rows.length ? groupResults(rows, limit) : []
    }

    if (mode === "emoji") {
      const rows = emojiResults(text)

      return rows.length ? groupResults(rows, limit) : []
    }

    if (mode === "clip") {
      const rows = clipResults(clips, text)

      return rows.length
        ? groupResults([...rows, clearClipsResult()], limit)
        : []
    }

    if (!text) {
      return emptyGroups()
    }

    const candidates: Result[] = [
      ...apps.map(asApp),
      ...(launcher.showWindows
        ? windows.map(w => windowResult(w, icons[w.process]))
        : []),
      ...(launcher.showCommands ? [...systemCommands, ...settingsLinks] : []),
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
  })

  const flat = $derived(groups.flatMap(g => g.items))
  const active = $derived(Math.min(cursor, Math.max(flat.length - 1, 0)))
  const compact = $derived(profile.appearance.density === "compact")

  const MODE_LABELS: Record<Route["mode"], string> = {
    run: "Run",
    todo: "Todo",
    calc: "Calc",
    clip: "Clip",
    emoji: "Emoji",
    timer: "Timer",
    search: "",
  }

  const modeLabel = $derived(
    route.mode === "timer"
      ? timerKindLabel(route.kind)
      : MODE_LABELS[route.mode],
  )

  const emptyMessage = $derived.by(() => {
    if (route.mode === "run") {
      return "Type a command"
    }

    if (route.mode === "todo") {
      return "Type a task"
    }

    if (route.mode === "calc") {
      return "Type an expression or a conversion"
    }

    if (route.mode === "timer") {
      return route.kind === "alarm"
        ? "Type a time, like 7:30 wake up"
        : "Type a duration, like 5m tea"
    }

    if (route.mode === "emoji") {
      return "No emoji found"
    }

    if (route.mode === "clip" && !route.text) {
      return "Clipboard history is empty"
    }

    if (route.text) {
      return "No results"
    }

    return apps.length ? "Search apps, windows and commands" : "Loading apps"
  })

  $effect(() => {
    for (const item of flat) {
      const path = item.iconPath

      if (!path || item.icon.startsWith("data:")) {
        continue
      }

      appIcon(path).then(icon => {
        if (icon) {
          icons[path] = icon
        }
      })
    }
  })

  $effect(() => {
    list
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" })
  })

  const hide = async () => {
    menu = null
    await appWindow.hide()
    setQuery("")
  }

  const perform = async (
    item: Result,
    run: () => void | Promise<void>,
    stay = false,
  ) => {
    menu = null

    try {
      await run()
    } catch (e) {
      error = `Could not open ${item.title} (${e})`

      return
    }

    const remembered =
      item.kind === "app" || item.kind === "command" || item.kind === "setting"

    if (remembered) {
      record(item.id).then(() => (usage += 1))
    }

    if (stay) {
      await refreshClips()

      return
    }

    await hide()
  }

  const secondary = (item: Result | undefined, label: string) =>
    item?.secondaryActions.find(a => a.label === label)

  const run = (
    item: Result | undefined,
    variant: "open" | "admin" | "location" = "open",
  ) => {
    if (!item) {
      return
    }

    const alt =
      variant === "admin"
        ? secondary(item, ADMIN)
        : variant === "location"
          ? secondary(item, LOCATION)
          : undefined

    perform(item, alt?.run ?? item.action, alt?.stay ?? item.stay)
  }

  const move = (delta: number) => {
    const count = flat.length

    if (count) {
      cursor = (((active + delta) % count) + count) % count
    }
  }

  const jumpGroup = (direction: 1 | -1) => {
    if (groups.length < 2) {
      return
    }

    const current = groups.findIndex(
      g => active >= g.start && active < g.start + g.items.length,
    )
    const next = (current + direction + groups.length) % groups.length

    cursor = groups[next].start
  }

  const menuItems = $derived.by((): SecondaryAction[] => {
    const item = menu ? flat[menu.index] : undefined

    return item
      ? [
          {
            label: item.kind === "clip" ? "Paste" : "Open",
            run: item.action,
            stay: item.stay,
          },
          ...item.secondaryActions,
        ]
      : []
  })

  const menuStyle = $derived.by(() => {
    if (!menu) {
      return ""
    }

    const maxLeft = window.innerWidth - MENU_WIDTH - 8
    const maxTop = window.innerHeight - (menuItems.length * 36 + 16) - 8
    const left = Math.max(8, Math.min(menu.x, maxLeft))
    const top = Math.max(8, Math.min(menu.y, maxTop))

    return `left:${left}px; top:${top}px; width:${MENU_WIDTH}px`
  })

  const openMenu = (index: number, x: number, y: number) => {
    cursor = index
    menuCursor = 0
    menu = { index, x, y }
  }

  const openMenuAtActive = () => {
    const rect = list
      ?.querySelector(`[data-index="${active}"]`)
      ?.getBoundingClientRect()

    if (rect) {
      openMenu(active, rect.left + 56, rect.bottom)
    }
  }

  const runMenu = (action: SecondaryAction | undefined) => {
    const item = menu ? flat[menu.index] : undefined

    if (item && action) {
      perform(item, action.run, action.stay)
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (menu) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()

        const count = menuItems.length
        const step = e.key === "ArrowDown" ? 1 : count - 1

        menuCursor = (menuCursor + step) % count
      } else if (e.key === "Enter") {
        e.preventDefault()
        runMenu(menuItems[menuCursor])
      } else if (e.key === "Escape") {
        e.preventDefault()
        menu = null
      }

      return
    }

    if (e.altKey && e.key >= "1" && e.key <= "9") {
      e.preventDefault()
      run(flat[Number(e.key) - 1])

      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        move(1)

        return
      case "ArrowUp":
        e.preventDefault()
        move(-1)

        return
      case "PageDown":
        e.preventDefault()
        cursor = Math.max(0, Math.min(active + PAGE, flat.length - 1))

        return
      case "PageUp":
        e.preventDefault()
        cursor = Math.max(active - PAGE, 0)

        return
      case "Tab":
        e.preventDefault()
        jumpGroup(e.shiftKey ? -1 : 1)

        return
      case "Enter":
        e.preventDefault()
        run(
          flat[active],
          e.shiftKey ? "admin" : e.ctrlKey ? "location" : "open",
        )

        return
      case "Escape":
        e.preventDefault()

        if (query) {
          setQuery("")
        } else {
          hide()
        }

        return
      case "Backspace":
        if (e.ctrlKey) {
          e.preventDefault()
          setQuery("")
        }

        return
      case "ContextMenu":
        e.preventDefault()
        openMenuAtActive()

        return
    }

    const typing =
      e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey

    if (typing && document.activeElement !== input) {
      input?.focus()
    }
  }

  const onmousedown = (e: MouseEvent) => {
    const target = e.target as Element

    if (menu && !target.closest("[data-menu]")) {
      menu = null

      return
    }

    if (backdropMenu) {
      return
    }

    if (e.button === 0 && !target.closest("[data-launcher]")) {
      hideWindow("main").catch(() => undefined)
    }
  }

  let backdropMenu = $state(false)
  let backdropMenuX = $state(0)
  let backdropMenuY = $state(0)

  const backdropItems = $derived.by((): MenuItem[] => [
    {
      label: query ? "Clear search" : "Focus search",
      icon: query ? "lucide:eraser" : "lucide:search",
      action: () => {
        setQuery("")
        input?.focus()
      },
    },
    {
      label: device.showKeymap ? "Hide keyboard hints" : "Show keyboard hints",
      icon: device.showKeymap ? "lucide:eye-off" : "lucide:eye",
      action: () => saveDevice({ ...device, showKeymap: !device.showKeymap }),
    },
    "separator",
    {
      label: "Eris 설정",
      icon: "lucide:settings",
      action: () => showWindow("settings"),
    },
  ])

  const openBackdropMenu = (e: MouseEvent) => {
    if ((e.target as Element).closest("[data-launcher]")) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    backdropMenuX = e.clientX
    backdropMenuY = e.clientY
    backdropMenu = true
  }

  const HINTS: [string, string][] = [
    [">", "Run"],
    ["t", "Todo"],
    ["=", "Calc"],
    [":", "Emoji"],
    ["v", "Clipboard"],
    ["timer", "Timer"],
  ]

  const insertPrefix = (prefix: string) => {
    setQuery(prefix)
    input?.focus()
  }
</script>

<svelte:window {onkeydown} {onmousedown} onfocus={() => input?.focus()} />

<main
  class="relative flex min-h-0 grow select-none flex-col gap-3 p-4"
  oncontextmenu={openBackdropMenu}
>
  <label
    data-launcher
    class="input input-lg flex h-14 w-full items-center gap-3 rounded-box border border-base-content/10 bg-base-100/60 px-4 shadow-lg outline-none backdrop-blur-xl transition-[border-color,box-shadow] duration-150 focus-within:border-primary/40 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/20"
  >
    <Icon icon="lucide:search" class="size-5 shrink-0 text-base-content/60" />

    <input
      bind:this={input}
      bind:value={query}
      oninput={reset}
      type="text"
      placeholder="Search apps, windows and commands"
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      class="min-w-0 grow select-text bg-transparent text-lg outline-none placeholder:text-base-content/40"
    />

    {#if modeLabel}
      <span class="badge badge-soft badge-primary badge-sm shrink-0">{modeLabel}</span>
    {/if}

    {#if query}
      <button
        type="button"
        class="btn btn-circle btn-ghost btn-xs shrink-0"
        aria-label="Clear"
        tabindex="-1"
        onclick={() => setQuery("")}
      >
        <Icon icon="lucide:x" class="size-4" />
      </button>
    {/if}
  </label>

  <div
    data-launcher
    class="flex min-h-0 grow flex-col overflow-hidden rounded-box border border-base-content/10 bg-base-100/60 shadow-lg backdrop-blur-xl"
  >
    <div
      bind:this={list}
      role="listbox"
      aria-label="Results"
      tabindex="-1"
      class={["min-h-0 grow overflow-y-auto", compact ? "p-1" : "p-1.5"]}
    >
      {#each groups as group (group.label)}
        <div
          class={[
            "flex items-center justify-between px-3 text-xs font-medium text-base-content/50",
            compact ? "pt-1.5 pb-0.5" : "pt-2 pb-1",
          ]}
        >
          <span>{group.label}</span>
          <span class="tabular-nums">{group.items.length}</span>
        </div>

        {#each group.items as item, j (item.id)}
          {@const i = group.start + j}
          <div
            role="option"
            aria-selected={i === active}
            data-index={i}
            tabindex="-1"
            class={[
              "group flex items-center gap-2 rounded-field px-2 transition-colors duration-150",
              compact ? "py-1" : "py-1.5",
              i === active
                ? "bg-primary/15 ring-1 ring-primary/30 ring-inset"
                : "hover:bg-base-content/5",
            ]}
            onmousemove={() => (cursor = i)}
            oncontextmenu={e => {
              e.preventDefault()
              openMenu(i, e.clientX, e.clientY)
            }}
          >
            <button
              type="button"
              class="flex min-w-0 grow items-center gap-3 text-left"
              tabindex="-1"
              onclick={() => run(item)}
            >
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-selector bg-base-content/5"
              >
                {#if item.kind === "emoji"}
                  <span class="text-2xl leading-none">{item.icon}</span>
                {:else if item.icon.startsWith("data:")}
                  <img src={item.icon} alt="" class="size-6" />
                {:else}
                  <Icon icon={item.icon} class="size-5 text-base-content/80" />
                {/if}
              </span>

              <span class="min-w-0 grow">
                <span class="flex items-center gap-2">
                  <span class="truncate font-medium">{item.title}</span>

                  {#each item.chips ?? [] as chip}
                    <span class="badge badge-ghost badge-xs shrink-0">{chip}</span>
                  {/each}
                </span>

                {#if item.subtitle}
                  <span class="block truncate text-xs text-base-content/55">
                    {item.subtitle}
                  </span>
                {/if}
              </span>
            </button>

            {#if i < 9 && device.showKeymap}
              <kbd
                class={[
                  "kbd kbd-xs shrink-0 transition-opacity duration-150",
                  i === active ? "opacity-60" : "opacity-0 group-hover:opacity-40",
                ]}
              >
                Alt {i + 1}
              </kbd>
            {/if}

            <span class="badge badge-ghost badge-sm shrink-0">
              {kindLabels[item.kind]}
            </span>

            <button
              type="button"
              class={[
                "btn btn-circle btn-ghost btn-xs shrink-0 transition-opacity duration-150",
                i === active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              ]}
              aria-label="More actions"
              tabindex="-1"
              onclick={e => {
                e.stopPropagation()

                const rect = e.currentTarget.getBoundingClientRect()

                openMenu(i, rect.right - MENU_WIDTH, rect.bottom + 4)
              }}
            >
              <Icon icon="lucide:ellipsis" class="size-4" />
            </button>
          </div>
        {/each}
      {:else}
        <div
          class="flex h-full flex-col items-center justify-center gap-2 text-base-content/50"
        >
          <Icon
            icon={route.text || route.mode !== "search"
              ? "lucide:search-x"
              : "lucide:sparkles"}
            class="size-7 opacity-50"
          />

          <p class="text-sm">{emptyMessage}</p>
        </div>
      {/each}
    </div>
  </div>

  <footer
    data-launcher
    class={[
      "items-center justify-between gap-3 px-2 text-xs text-base-content/50",
      device.showKeymap || error || query ? "flex" : "hidden",
    ]}
  >
    {#if error}
      <span class="truncate text-error">{error}</span>
    {:else if query}
      <span class="tabular-nums">
        {flat.length}
        {flat.length === 1 ? "result" : "results"}
      </span>
    {:else if device.showKeymap}
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        {#each HINTS as [key, label] (key)}
          <button
            type="button"
            class="flex items-center gap-1 transition-colors duration-150 hover:text-base-content"
            tabindex="-1"
            onclick={() => insertPrefix(key === ":" ? key : `${key} `)}
          >
            <kbd class="kbd kbd-xs">{key}</kbd>
            {label}
          </button>
        {/each}
      </div>
    {/if}

    {#if query && device.showKeymap}
      <div class="flex shrink-0 items-center gap-3">
        <span class="flex items-center gap-1">
          <kbd class="kbd kbd-xs">↵</kbd>
          {enterLabel}
        </span>

        {#if secondary(flat[active], ADMIN)}
          <span class="flex items-center gap-1">
            <kbd class="kbd kbd-xs">⇧↵</kbd> Admin
          </span>
        {/if}

        {#if secondary(flat[active], LOCATION)}
          <span class="flex items-center gap-1">
            <kbd class="kbd kbd-xs">⌃↵</kbd> Location
          </span>
        {/if}
      </div>
    {:else if groups.length > 1 && device.showKeymap}
      <span class="flex shrink-0 items-center gap-1">
        <kbd class="kbd kbd-xs">Tab</kbd> Groups
      </span>
    {/if}
  </footer>

  <ContextMenu
    bind:open={backdropMenu}
    items={backdropItems}
    x={backdropMenuX}
    y={backdropMenuY}
    placement="down"
    width={224}
    label="Launcher menu"
  />

  {#if menu}
    <ul
      data-menu
      class="menu absolute z-50 rounded-box border border-base-content/10 bg-base-100/80 p-1 shadow-xl backdrop-blur-xl"
      style={menuStyle}
    >
      {#each menuItems as action, k (action.label)}
        <li>
          <button
            type="button"
            class={["rounded-field", k === menuCursor && "menu-active"]}
            tabindex="-1"
            onmousemove={() => (menuCursor = k)}
            onclick={() => runMenu(action)}
          >
            {action.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</main>
