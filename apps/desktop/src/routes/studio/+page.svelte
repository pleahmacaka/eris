<script lang="ts">
  import Icon from "@iconify/svelte"
  import { base } from "$app/paths"
  import { saveProfileSynced } from "$lib/data"
  import { CUSTOM } from "$lib/settings-ui"
  import type { TaskbarLayout } from "$lib/native"
  import {
    BARS,
    type BusMessage,
    IpcLog,
    type LogEntry,
    mocked,
    openBus,
    publish,
    readStore,
    resetStores,
    type Surface,
    surfaces,
    writeStore,
  } from "$lib/studio"
  import {
    type DeviceSettings,
    loadDevice,
    loadProfile,
    type Profile,
    updateDevice,
    withProfileDefaults,
  } from "@eris/settings"
  import { Confirm, Logo, Segmented } from "@eris/ui"
  import { t } from "svelte-i18n"

  type Bar = {
    edge: "top" | "bottom"
    height: number
    width: number
    floating: boolean
    reach: number
    hole: number[] | null
    on: boolean
  }

  type Mode = "dark" | "light"

  type LogSide = "bottom" | "right"

  const MENU_SPACE = 520
  const FLOAT_MARGIN = 12
  const LOG_LIMIT = 400
  const SETTINGS = "settings.json"
  const APPLIED_FOR = 2_500
  const LOG_KEY = "eris-studio-log"
  const LOG_MIN = 120
  const LOG_MAX = 0.7

  const MACHINE: (keyof DeviceSettings)[] = [
    "deviceId",
    "deviceName",
    "onboarded",
    "autostart",
    "pinnedApps",
    "hiddenApps",
    "dockOrder",
    "trayOrder",
    "trayHidden",
    "dockMonitor",
    "sync",
    "studio",
  ]

  const live = !mocked()

  const params = new URLSearchParams(location.search)

  const returnTo = (() => {
    try {
      const url = new URL(params.get("return") ?? "", location.href)
      const trusted =
        url.origin === location.origin ||
        (import.meta.env.DEV && url.hostname === "localhost")

      return params.has("return") && trusted ? url : null
    } catch {
      return null
    }
  })()

  const given = (): Partial<Profile["appearance"]> | null => {
    try {
      const raw: unknown = JSON.parse(params.get("appearance") ?? "null")

      return raw && typeof raw === "object" ? raw : null
    } catch {
      return null
    }
  }

  const dev = import.meta.env.DEV

  const NAMED = [
    "main",
    "taskbar",
    "topbar",
    "settings",
    "panel",
    "notices",
    "onboarding",
    "preview",
    "files",
    "edit",
  ]

  const nameOf = (label: string) =>
    NAMED.includes(label) ? $t(`studio.names.${label}`) : label

  type LogLayout = { side: LogSide; sizes: Record<LogSide, number> }

  const LOG_DEFAULT: LogLayout = { side: "right", sizes: { bottom: 224, right: 440 } }

  const storedLog = (): LogLayout => {
    try {
      return { ...LOG_DEFAULT, ...JSON.parse(localStorage.getItem(LOG_KEY) ?? "{}") }
    } catch {
      return LOG_DEFAULT
    }
  }

  const windows = surfaces.filter(
    s => !BARS.includes(s.label) && s.label !== "studio",
  )

  const storedProfile = () =>
    withProfileDefaults(readStore(SETTINGS).profile as Partial<Profile>)

  const seeded = live ? null : given()

  if (seeded) {
    const profile = storedProfile()

    writeStore(SETTINGS, {
      ...readStore(SETTINGS),
      profile: {
        ...profile,
        presetId: CUSTOM,
        appearance: { ...profile.appearance, ...seeded },
      },
    })
  }

  const initial = windows.find(s => s.label === "settings") ?? null

  let selected = $state.raw<Surface | null>(initial)
  let width = $state(initial?.width ?? 0)
  let height = $state(initial?.height ?? 0)
  let generation = $state(0)
  let ready = $state(!live)
  let confirming = $state(false)
  let applied = $state(false)
  let logOpen = $state(true)
  let logLayout = $state<LogLayout>(storedLog())

  const logSide = $derived(logLayout.side)

  const logSize = $derived(logLayout.sizes[logLayout.side])
  let entries = $state.raw<LogEntry[]>([])
  let mode = $state<Mode>(
    storedProfile().appearance.mode === "light" ? "light" : "dark",
  )
  let dock = $state<Bar>({
    edge: "bottom",
    height: 48,
    width: 720,
    floating: false,
    reach: 0,
    hole: null,
    on: true,
  })
  let top = $state<Bar>({
    edge: "top",
    height: 34,
    width: 720,
    floating: false,
    reach: 0,
    hole: null,
    on: false,
  })
  let seq = 0

  const select = (surface: Surface | null) => {
    selected = surface
    width = surface?.width ?? 0
    height = surface?.height ?? 0
  }

  const log = (entry: Omit<LogEntry, "id" | "at">) => {
    seq += 1
    entries = [
      ...entries.slice(1 - LOG_LIMIT),
      { ...entry, id: seq, at: Date.now() },
    ]
  }

  const place = (bar: Bar, layout: TaskbarLayout): Bar => ({
    ...bar,
    edge: layout.edge,
    height: layout.height,
    width: layout.width,
    floating: layout.floating,
    on: true,
  })

  const track = (cmd: string, args: Record<string, unknown>) => {
    const layout = args.layout as TaskbarLayout
    const reach = Math.min(MENU_SPACE, Math.max(0, Number(args.px) || 0))
    const hole = Array.isArray(args.rect) ? args.rect.map(Number) : null

    if (cmd === "apply_taskbar") {
      dock = place(dock, layout)
    } else if (cmd === "apply_topbar") {
      top = place(top, layout)
    } else if (cmd === "extend_taskbar") {
      dock = { ...dock, reach, hole }
    } else if (cmd === "extend_topbar") {
      top = { ...top, reach, hole }
    } else if (cmd === "release_topbar") {
      top.on = false
    }
  }

  const follow = (event: string, payload: unknown) => {
    const surface = windows.find(s => s.label === payload)

    if (event === "window-shown" && surface) {
      select(surface)
    }

    if (event === "window-hidden" && surface && surface === selected) {
      select(null)
    }
  }

  $effect(() => {
    const bus = openBus()

    bus.onmessage = (e: MessageEvent<BusMessage>) => {
      const message = e.data

      if (message.kind === "event") {
        follow(message.event, message.payload)
        log({
          kind: "event",
          label: "event",
          name: message.event,
          detail: JSON.stringify(message.payload) ?? "",
        })

        return
      }

      const args = (message.args ?? {}) as Record<string, unknown>

      track(message.cmd, args)
      log({
        kind: message.mocked ? "ipc" : "missing",
        label: message.label,
        name: message.cmd,
        detail: JSON.stringify(args),
      })
    }

    return () => bus.close()
  })

  const modeOf = (profile: Profile): Mode =>
    profile.appearance.mode === "light" ? "light" : "dark"

  const seed = async () => {
    const [device, profile] = await Promise.all([loadDevice(), loadProfile()])

    writeStore(SETTINGS, { ...readStore(SETTINGS), device, profile })
    mode = modeOf(profile)
  }

  $effect(() => {
    if (!live || readStore(SETTINGS).device) {
      ready = true

      return
    }

    seed().finally(() => {
      ready = true
    })
  })

  const apply = async () => {
    const stored = readStore(SETTINGS)

    if (!stored.device || !stored.profile) {
      return
    }

    const sandbox: Partial<DeviceSettings> = { ...stored.device }

    for (const key of MACHINE) {
      delete sandbox[key]
    }

    await updateDevice(current => ({ ...current, ...sandbox }))
    await saveProfileSynced(withProfileDefaults(stored.profile as Partial<Profile>))

    applied = true
    setTimeout(() => {
      applied = false
    }, APPLIED_FOR)
  }

  const setMode = (next: Mode) => {
    const stored = readStore(SETTINGS)
    const profile = storedProfile()

    profile.appearance.mode = next
    profile.presetId = CUSTOM
    writeStore(SETTINGS, { ...stored, profile })
    publish("profile-changed", profile)
    mode = next
  }

  $effect(() => {
    localStorage.setItem(LOG_KEY, JSON.stringify(logLayout))
  })

  const resizeLog = (e: PointerEvent) => {
    const handle = e.currentTarget as HTMLElement
    const bottom = logSide === "bottom"
    const start = bottom ? e.clientY : e.clientX
    const from = logSize
    const limit = (bottom ? innerHeight : innerWidth) * LOG_MAX

    const move = (m: PointerEvent) => {
      const delta = (bottom ? m.clientY : m.clientX) - start

      logLayout.sizes[logLayout.side] = Math.round(
        Math.min(limit, Math.max(LOG_MIN, from - delta)),
      )
    }

    const stop = () => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", stop)
    }

    handle.setPointerCapture(e.pointerId)
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", stop)
  }

  const publishTheme = () => {
    const back = returnTo ?? new URL("../themes/?edit=", location.href)

    back.searchParams.set("studio", JSON.stringify(storedProfile().appearance))
    location.href = back.href
  }

  const reload = () => {
    generation += 1
  }

  const reset = async () => {
    resetStores()
    entries = []

    if (live) {
      await seed()
    } else {
      mode = modeOf(storedProfile())
    }

    reload()
  }

  const region = (bar: Bar) => {
    const [left, top, right, bottom] = bar.hole ?? []

    if (bar.edge === "top") {
      const band = bar.height + bar.reach
      const reach = Math.max(band, bottom ?? band)

      return bar.hole
        ? `polygon(0 0, 100% 0, 100% ${band}px, ${right}px ${band}px, ${right}px ${reach}px, ${left}px ${reach}px, ${left}px ${band}px, 0 ${band}px)`
        : `inset(0 0 calc(100% - ${band}px) 0)`
    }

    const band = MENU_SPACE - bar.reach
    const reach = Math.min(band, top ?? band)

    return bar.hole
      ? `polygon(0 ${band}px, ${left}px ${band}px, ${left}px ${reach}px, ${right}px ${reach}px, ${right}px ${band}px, 100% ${band}px, 100% 100%, 0 100%)`
      : `inset(${band}px 0 0 0)`
  }

  const barStyle = (bar: Bar) => {
    const clip = region(bar)
    const margin = bar.floating ? FLOAT_MARGIN : 0
    const left = bar.floating ? `calc(50% - ${bar.width / 2}px)` : "0"

    return [
      `left: ${left}`,
      `width: ${bar.floating ? `${bar.width}px` : "100%"}`,
      `height: ${bar.height + MENU_SPACE}px`,
      `${bar.edge}: ${margin}px`,
      `clip-path: ${clip}`,
    ].join("; ")
  }

  const band = (bar: Bar, edge: Bar["edge"]) =>
    bar.on && bar.edge === edge
      ? bar.height + (bar.floating ? FLOAT_MARGIN * 2 : 0)
      : 0

  const insetTop = $derived(band(dock, "top") + band(top, "top"))
  const insetBottom = $derived(band(dock, "bottom"))
</script>

<div class="flex min-h-0 grow flex-col bg-base-200">
  <header class="flex items-center gap-2 border-b border-base-content/10 px-3 py-2">
    <Logo class="size-4" />

    <h1 class="text-sm font-semibold">Studio</h1>

    <span class="grow"></span>

    <Segmented
      value={mode}
      options={[
        { value: "dark", label: $t("settings.options.dark") },
        { value: "light", label: $t("settings.options.light") },
      ]}
      onchange={setMode}
    />

    <button type="button" class="btn btn-ghost btn-sm" onclick={reload}>
      <Icon icon="lucide:rotate-cw" class="size-4" />
      {$t("studio.reload")}
    </button>

    {#if live || dev}
      <button type="button" class="btn btn-ghost btn-sm" onclick={reset}>
        <Icon icon="lucide:eraser" class="size-4" />
        {live ? $t("studio.reloadSettings") : $t("studio.resetData")}
      </button>
    {/if}

    {#if live}
      <button
        type="button"
        class="btn btn-primary btn-sm"
        disabled={applied}
        onclick={() => (confirming = true)}
      >
        <Icon icon={applied ? "lucide:check" : "lucide:upload"} class="size-4" />
        {applied ? $t("studio.applied") : $t("studio.apply")}
      </button>
    {/if}

    {#if !live && (returnTo || !dev)}
      <button type="button" class="btn btn-primary btn-sm" onclick={publishTheme}>
        <Icon icon="lucide:send" class="size-4" />
        {$t("studio.publish")}
      </button>
    {/if}

    {#if dev}
      <button
        type="button"
        class={["btn btn-sm", logOpen ? "btn-soft btn-primary" : "btn-ghost"]}
        aria-pressed={logOpen}
        onclick={() => (logOpen = !logOpen)}
      >
        <Icon icon="lucide:scroll-text" class="size-4" />
        IPC log
      </button>
    {/if}
  </header>

  <div class="flex min-h-0 grow">
    <nav class="flex w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-base-content/10 p-2">
      <p class="px-2 pt-1 pb-1 text-xs font-semibold text-base-content/50">
        {$t("studio.windows")}
      </p>

      <ul class="menu w-full gap-0.5 p-0">
        {#each windows as s (s.label)}
          <li>
            <button
              type="button"
              class={["justify-between", selected === s && "menu-active"]}
              aria-current={selected === s ? "page" : undefined}
              onclick={() => select(selected === s ? null : s)}
            >
              {nameOf(s.label)}

              {#if dev}
                <span class="text-xs tabular-nums opacity-60">{s.width}×{s.height}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>

      {#if dev && selected?.resizable}
        <div class="mt-3 flex flex-col gap-2 border-t border-base-content/10 px-2 pt-3">
          <label class="input input-sm">
            <span class="label">Width</span>
            <input type="number" min={selected.minWidth} step="10" bind:value={width} />
          </label>

          <label class="input input-sm">
            <span class="label">Height</span>
            <input type="number" min={selected.minHeight} step="10" bind:value={height} />
          </label>

          <div class="flex gap-1">
            <button
              type="button"
              class="btn btn-soft btn-xs grow"
              onclick={() => {
                width = selected?.minWidth ?? width
                height = selected?.minHeight ?? height
              }}
            >
              Minimum
            </button>

            <button type="button" class="btn btn-soft btn-xs grow" onclick={() => select(selected)}>
              Default
            </button>
          </div>
        </div>
      {/if}
    </nav>

    <main class="desktop relative min-h-0 min-w-0 grow overflow-hidden">
      {#key generation}
        {#if ready}
          <div
            class="absolute inset-x-0 flex overflow-auto p-4"
            style:top="{insetTop}px"
            style:bottom="{insetBottom}px"
          >
            {#if selected}
              {#key selected.label}
                <iframe
                  title={nameOf(selected.label)}
                  src={base + selected.url}
                  class="m-auto shrink-0"
                  style:width="{width}px"
                  style:height="{height}px"
                ></iframe>
              {/key}
            {:else}
              <p class="m-auto text-sm text-base-content/60">{$t("studio.pick")}</p>
            {/if}
          </div>

          <iframe
            title={nameOf("topbar")}
            src="{base}/topbar"
            class={["absolute z-10", !top.on && "invisible"]}
            style={barStyle(top)}
          ></iframe>

          <iframe
            title={nameOf("taskbar")}
            src="{base}/taskbar"
            class="absolute z-10"
            style={barStyle(dock)}
          ></iframe>
        {/if}
      {/key}
    </main>

    {#if dev && logOpen && logSide === "right"}
      {@render logPanel()}
    {/if}
  </div>

  {#if dev && logOpen && logSide === "bottom"}
    {@render logPanel()}
  {/if}
</div>

{#snippet logPanel()}
  {@const bottom = logSide === "bottom"}
  <div
    class={[
      "relative flex shrink-0 flex-col bg-base-100",
      bottom ? "border-t border-base-content/10" : "border-l border-base-content/10",
    ]}
    style:height={bottom ? `${logSize}px` : undefined}
    style:width={bottom ? undefined : `${logSize}px`}
  >
    <div
      role="separator"
      aria-orientation={bottom ? "horizontal" : "vertical"}
      class={[
        "absolute z-10 transition-colors duration-100 hover:bg-primary/40",
        bottom
          ? "inset-x-0 -top-0.5 h-1 cursor-row-resize"
          : "inset-y-0 -left-0.5 w-1 cursor-col-resize",
      ]}
      onpointerdown={resizeLog}
    ></div>

    <IpcLog
      {entries}
      side={logSide}
      onside={next => (logLayout.side = next)}
      onclear={() => (entries = [])}
    />
  </div>
{/snippet}

<Confirm
  bind:open={confirming}
  title={$t("studio.confirm.title")}
  body={$t("studio.confirm.body")}
  action={$t("studio.confirm.action")}
  cancel={$t("common.cancel")}
  onconfirm={apply}
/>

<style>
  .desktop {
    background-color: var(--color-base-300);
    background-image:
      radial-gradient(
        60% 50% at 20% 10%,
        color-mix(in oklch, var(--color-primary) 22%, transparent),
        transparent 70%
      ),
      radial-gradient(
        50% 60% at 90% 90%,
        color-mix(in oklch, var(--color-secondary) 16%, transparent),
        transparent 70%
      ),
      linear-gradient(
        to right,
        color-mix(in oklch, var(--color-base-content) 5%, transparent) 0.0625rem,
        transparent 0.0625rem
      ),
      linear-gradient(
        to bottom,
        color-mix(in oklch, var(--color-base-content) 5%, transparent) 0.0625rem,
        transparent 0.0625rem
      );
    background-size:
      100% 100%,
      100% 100%,
      4rem 4rem,
      4rem 4rem;
  }

  iframe {
    border: 0;
    background: transparent;
    color-scheme: normal;
  }
</style>
