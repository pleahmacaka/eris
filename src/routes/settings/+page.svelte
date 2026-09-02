<script lang="ts">
  import Icon from "@iconify/svelte"
  import { tick } from "svelte"
  import { listen } from "@tauri-apps/api/event"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart"
  import { saveProfileSynced } from "$lib/data/store"
  import { ensureDevice } from "$lib/device"
  import {
    onWindowShown,
    setLauncherShortcut,
    setWinKeyCapture,
    showWindow,
  } from "$lib/native"
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
  import Advanced from "$lib/settings-ui/Advanced.svelte"
  import AppearanceControls from "$lib/settings-ui/AppearanceControls.svelte"
  import DockControls from "$lib/settings-ui/DockControls.svelte"
  import HotkeyPicker from "$lib/settings-ui/HotkeyPicker.svelte"
  import ImportExport from "$lib/settings-ui/ImportExport.svelte"
  import PresetGrid from "$lib/settings-ui/PresetGrid.svelte"
  import Row from "$lib/settings-ui/Row.svelte"
  import Section from "$lib/settings-ui/Section.svelte"
  import Segmented from "$lib/settings-ui/Segmented.svelte"
  import SyncPanel from "$lib/settings-ui/SyncPanel.svelte"
  import { stableJson } from "$lib/settings-ui/json"
  import {
    searchRows,
    searchSections,
    type SearchEntry,
    type SectionId,
    sections,
  } from "$lib/settings-ui/search"
  import { toast } from "$lib/settings-ui/toast.svelte"
  import Toasts from "$lib/settings-ui/Toasts.svelte"
  import { applyAppearance } from "$lib/theme"

  const VERSION = "0.1.0"
  const appWindow = getCurrentWindow()

  const reminders = [0, 5, 10, 15, 30, 60]

  let section = $state<SectionId>("general")
  let query = $state("")
  let device = $state<DeviceSettings>(structuredClone(defaultDevice))
  let profile = $state<Profile>(structuredClone(defaultProfile))
  let ready = $state(false)
  let scroller = $state<HTMLElement>()
  let deviceJson = ""
  let profileJson = ""

  const current = $derived(
    sections.find(s => s.id === section) ?? sections[0],
  )

  const found = $derived(searchRows(query))
  const visible = $derived(searchSections(query))

  const jump = async (entry: SearchEntry) => {
    section = entry.section
    await tick()

    const row = scroller?.querySelector<HTMLElement>(
      `[data-row="${entry.label}"]`,
    )

    if (!row) {
      return
    }

    row.scrollIntoView({ block: "center", behavior: "smooth" })
    row.classList.add("row-flash")
    setTimeout(() => row.classList.remove("row-flash"), 1400)
  }

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  const persistDevice = async () => {
    const snapshot = $state.snapshot(device)

    deviceJson = stableJson(snapshot)
    await saveDevice(snapshot)
  }

  const persistProfile = async () => {
    const snapshot = $state.snapshot(profile)

    profileJson = stableJson(snapshot)
    await saveProfileSynced(snapshot)
  }

  $effect(() => {
    Promise.all([ensureDevice(), loadProfile()]).then(([d, p]) => {
      deviceJson = stableJson(d)
      profileJson = stableJson(p)
      device = d
      profile = p
      ready = true

      isEnabled()
        .then(on => {
          if (device.autostart !== on) {
            device.autostart = on
          }
        })
        .catch(() => undefined)
    })

    const stops = [
      onDevice(value => {
        const json = stableJson(value)

        if (json !== deviceJson) {
          deviceJson = json
          device = value
        }
      }),
      onProfile(value => {
        const json = stableJson(value)

        if (json !== profileJson) {
          profileJson = json
          profile = value
        }
      }),
      listen<string>("settings-section", e => {
        if (sections.some(s => s.id === e.payload)) {
          section = e.payload as SectionId
        }
      }),
      onWindowShown("settings", () => {
        query = ""
      }),
    ]

    return () => {
      for (const stop of stops) {
        stop.then(fn => fn())
      }
    }
  })

  $effect(() => {
    const json = stableJson(device)

    if (!ready || json === deviceJson) {
      return
    }

    const timer = setTimeout(persistDevice, 150)

    return () => clearTimeout(timer)
  })

  $effect(() => {
    const json = stableJson(profile)

    if (!ready || json === profileJson) {
      return
    }

    const timer = setTimeout(persistProfile, 300)

    return () => clearTimeout(timer)
  })

  const appearanceJson = $derived(stableJson(profile.appearance))

  $effect(() => {
    if (ready) {
      applyAppearance(JSON.parse(appearanceJson))
    }
  })

  const hotkey = $derived(
    `${device.launcherTrigger}|${device.launcherShortcut}`,
  )

  $effect(() => {
    const [trigger, shortcut] = hotkey.split("|")

    if (!ready) {
      return
    }

    setWinKeyCapture(trigger !== "shortcut").catch(() => undefined)
    setLauncherShortcut(trigger === "win" ? null : shortcut).catch(error =>
      toast(`Shortcut not registered: ${message(error)}`, "error"),
    )
  })

  $effect(() => {
    section
    scroller?.scrollTo({ top: 0 })
  })

  const setAutostart = async (on: boolean) => {
    try {
      if (on) {
        await enable()
      } else {
        await disable()
      }

      device.autostart = on
    } catch (error) {
      toast(`Autostart failed: ${message(error)}`, "error")
    }
  }

  const resetOnboarding = async () => {
    device.onboarded = false
    await persistDevice()
    await showWindow("onboarding")
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || document.querySelector("dialog[open]")) {
      return
    }

    if (query) {
      query = ""
    } else {
      appWindow.hide()
    }
  }

  const chips = (shortcut: string) =>
    shortcut.split("+").map(part => (part === "Super" ? "Win" : part))

  const shortcuts = $derived([
    {
      title: "Launcher",
      items: [
        ...(device.launcherTrigger !== "shortcut"
          ? [{ keys: ["Win"], action: "Open the launcher" }]
          : []),
        ...(device.launcherTrigger !== "win"
          ? [
              {
                keys: chips(device.launcherShortcut),
                action: "Open the launcher",
              },
            ]
          : []),
        { keys: ["Up", "Down"], action: "Move the selection" },
        { keys: ["Page up", "Page down"], action: "Move a page" },
        { keys: ["Tab"], action: "Next group" },
        { keys: ["Shift", "Tab"], action: "Previous group" },
        { keys: ["Enter"], action: "Open the selected result" },
        { keys: ["Shift", "Enter"], action: "Open as administrator" },
        { keys: ["Ctrl", "Enter"], action: "Open the file location" },
        { keys: ["Alt", "1-9"], action: "Open a numbered result" },
        { keys: ["Menu"], action: "Open the action menu" },
        { keys: ["Ctrl", "Backspace"], action: "Clear the query" },
        { keys: ["Esc"], action: "Clear the query, then close" },
      ],
    },
    {
      title: "Calendar panel",
      items: [
        { keys: ["Left", "Right"], action: "Switch tabs" },
        { keys: ["Arrows"], action: "Move the selected day" },
        { keys: ["Enter"], action: "Add an event on that day" },
        { keys: ["F2"], action: "Rename the todo" },
        { keys: ["Ctrl", "Enter"], action: "Save the event" },
        { keys: ["Esc"], action: "Close the panel" },
      ],
    },
    {
      title: "Setup and settings",
      items: [
        { keys: ["Enter"], action: "Next setup step" },
        { keys: ["Esc"], action: "Close this window" },
      ],
    },
  ])
</script>

<svelte:window {onkeydown} />

<main class="flex min-h-0 grow flex-col">
  <header
    data-tauri-drag-region
    class="flex items-center gap-3 px-5 pt-4 pb-3"
  >
    <div class="pointer-events-none flex items-center gap-2">
      <div
        class="flex size-7 items-center justify-center rounded-field bg-primary/15 text-primary"
      >
        <Icon icon="lucide:settings-2" class="size-4" />
      </div>

      <h1 class="text-base font-semibold">Settings</h1>
    </div>

    <span data-tauri-drag-region class="grow"></span>

    <button
      type="button"
      class="btn btn-ghost btn-circle btn-sm"
      aria-label="Close"
      onclick={() => appWindow.hide()}
    >
      <Icon icon="lucide:x" class="size-4" />
    </button>
  </header>

  <div class="flex min-h-0 grow">
    <nav class="w-44 shrink-0 px-3 pb-4" aria-label="Sections">
      <label class="input input-sm mb-2 w-full">
        <Icon icon="lucide:search" class="size-3.5 shrink-0 opacity-50" />

        <input
          type="search"
          placeholder="Search"
          aria-label="Search settings"
          autocomplete="off"
          spellcheck="false"
          bind:value={query}
          onkeydown={e => {
            if (e.key === "Enter" && found[0]) {
              e.preventDefault()
              jump(found[0])
            }
          }}
        />
      </label>

      <ul class="menu w-full gap-0.5 p-0">
        {#each visible as s (s.id)}
          {@const rows = found.filter(r => r.section === s.id)}

          <li>
            <button
              type="button"
              class={[
                "rounded-field transition-colors duration-150",
                section === s.id && "menu-active",
              ]}
              aria-current={section === s.id ? "page" : undefined}
              onclick={() => (section = s.id)}
            >
              <Icon icon={s.icon} class="size-4" />
              {s.label}
            </button>

            {#if rows.length}
              <ul>
                {#each rows as r (r.label)}
                  <li>
                    <button
                      type="button"
                      class="rounded-field text-xs text-base-content/70"
                      onclick={() => jump(r)}
                    >
                      {r.label}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>

      {#if !visible.length}
        <p class="px-2 py-1 text-xs text-base-content/50">No matches</p>
      {/if}
    </nav>

    <div bind:this={scroller} class="min-h-0 grow overflow-y-auto px-5 pb-6">
      {#if ready}
        <div class="mb-4">
          <h2 class="text-xl font-semibold tracking-tight">{current.label}</h2>

          <p class="text-sm text-base-content/60">{current.blurb}</p>
        </div>

        <div class="flex flex-col gap-4">
          {#if section === "general"}
            <Section title="This device">
              <Row label="Device name" hint="Shown in the sync device list">
                <input
                  class="input input-sm w-52"
                  aria-label="Device name"
                  autocomplete="off"
                  spellcheck="false"
                  bind:value={device.deviceName}
                />
              </Row>

              <Row
                label="Start with Windows"
                hint="Launches Eris hidden at sign-in"
              >
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label="Start with Windows"
                  checked={device.autostart}
                  onchange={e => setAutostart(e.currentTarget.checked)}
                />
              </Row>

              <Row
                label="Hide Windows taskbar"
                hint="Eris takes over the edge"
              >
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label="Hide Windows taskbar"
                  bind:checked={device.hideSystemTaskbar}
                />
              </Row>

              <Row label="Language" hint="English only for now">
                <span class="text-sm text-base-content/70">English</span>
              </Row>

              <Row label="Setup wizard" hint="Runs the first-start setup again">
                <button
                  type="button"
                  class="btn btn-soft btn-sm"
                  onclick={resetOnboarding}
                >
                  Run setup
                </button>
              </Row>
            </Section>

            <Section
              title="Launcher hotkey"
              description="A Win tap opens Eris. Win combos keep working."
            >
              <Row label="Open with" hint="Which keys bring up the launcher">
                <Segmented
                  label="Open with"
                  bind:value={device.launcherTrigger}
                  options={[
                    { value: "win", label: "Win key" },
                    { value: "shortcut", label: "Shortcut" },
                    { value: "both", label: "Both" },
                  ]}
                />
              </Row>

              {#if device.launcherTrigger !== "win"}
                <Row label="Shortcut" hint="Click, then press the combination">
                  <HotkeyPicker bind:value={device.launcherShortcut} />
                </Row>
              {/if}
            </Section>

            <Section
              title="Backup"
              description="Settings, presets, todos, and events as one JSON file"
            >
              <ImportExport />
            </Section>
          {:else if section === "dock"}
            <Section title="Dock">
              <DockControls bind:device />
            </Section>
          {:else if section === "launcher"}
            <Section title="Results">
              <Row
                label="Results per group"
                value={String(profile.launcher.maxResults)}
                stacked
              >
                <input
                  type="range"
                  class="range range-primary range-xs w-full"
                  min="3"
                  max="15"
                  step="1"
                  aria-label="Results per group"
                  bind:value={profile.launcher.maxResults}
                />
              </Row>

              <Row label="Open windows" hint="Switch to running windows by name">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label="Open windows"
                  bind:checked={profile.launcher.showWindows}
                />
              </Row>

              <Row
                label="Commands"
                hint="Lock, sleep, empty the recycle bin, and more"
              >
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label="Commands"
                  bind:checked={profile.launcher.showCommands}
                />
              </Row>

              <Row label="Todos" hint="Add a todo straight from the search box">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label="Todos"
                  bind:checked={profile.launcher.showTodos}
                />
              </Row>

              <Row label="Calculator" hint="Type an expression to evaluate it">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label="Calculator"
                  bind:checked={profile.launcher.calculator}
                />
              </Row>

              <Row label="Web search" hint="Engine for queries nothing else matches">
                <select
                  class="select select-sm w-40"
                  aria-label="Web search"
                  bind:value={profile.launcher.webSearch}
                >
                  <option value="google">Google</option>
                  <option value="duckduckgo">DuckDuckGo</option>
                  <option value="bing">Bing</option>
                  <option value="naver">Naver</option>
                </select>
              </Row>
            </Section>
          {:else if section === "appearance"}
            <Section title="Presets" description="Pick a look, then fine-tune below">
              <div data-row="Presets" class="p-4">
                <PresetGrid bind:profile />
              </div>
            </Section>

            <Section
              title="Fine-tune"
              description="Changes preview live and mark the preset as custom"
            >
              <AppearanceControls bind:profile />
            </Section>
          {:else if section === "calendar"}
            <Section title="Calendar">
              <Row label="Week starts on">
                <Segmented
                  label="Week starts on"
                  bind:value={profile.calendar.weekStartsOn}
                  options={[
                    { value: 1, label: "Monday" },
                    { value: 0, label: "Sunday" },
                  ]}
                />
              </Row>

              <Row label="Week numbers" hint="Show week numbers in the month grid">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label="Week numbers"
                  bind:checked={profile.calendar.showWeekNumbers}
                />
              </Row>

              <Row label="Default reminder" hint="Before an event starts">
                <select
                  class="select select-sm w-40"
                  aria-label="Default reminder"
                  bind:value={profile.calendar.reminderMinutes}
                >
                  {#each reminders as minutes (minutes)}
                    <option value={minutes}>
                      {minutes === 0 ? "None" : `${minutes} min before`}
                    </option>
                  {/each}
                </select>
              </Row>
            </Section>

            <Section title="Todo">
              <Row label="Show completed" hint="Keep done items in the list">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label="Show completed"
                  bind:checked={profile.todo.showCompleted}
                />
              </Row>

              <Row label="Sort by">
                <Segmented
                  label="Sort by"
                  bind:value={profile.todo.sortBy}
                  options={[
                    { value: "manual", label: "Manual" },
                    { value: "due", label: "Due date" },
                    { value: "priority", label: "Priority" },
                  ]}
                />
              </Row>
            </Section>
          {:else if section === "sync"}
            <SyncPanel bind:device />
          {:else if section === "advanced"}
            <Advanced bind:device bind:profile />
          {:else if section === "about"}
            <Section title="Eris">
              <div data-row="Version" class="flex items-center gap-4 px-4 py-4">
                <div
                  class="flex size-12 items-center justify-center rounded-box bg-primary/15 text-primary"
                >
                  <Icon icon="lucide:sparkles" class="size-6" />
                </div>

                <div class="flex flex-col">
                  <div class="flex items-center gap-2">
                    <span class="text-base font-semibold">Eris</span>

                    <span class="badge badge-soft badge-primary badge-sm">
                      {VERSION}
                    </span>
                  </div>

                  <span class="text-sm text-base-content/60">
                    Launcher, dock, and calendar for Windows 11
                  </span>
                </div>
              </div>
            </Section>

            <div data-row="Keyboard shortcuts">
              <Section
                title="Keyboard shortcuts"
                description="Everything Eris listens for"
              >
                {#each shortcuts as group (group.title)}
                  <div class="py-1">
                    <span
                      class="block px-4 pt-2 pb-1 text-xs font-semibold text-base-content/60"
                    >
                      {group.title}
                    </span>

                    {#each group.items as s, at (at)}
                      <div
                        class="flex items-center justify-between gap-4 px-4 py-1.5"
                      >
                        <span class="text-sm">{s.action}</span>

                        <div class="flex items-center gap-1">
                          {#each s.keys as key, i (i)}
                            <kbd class="kbd kbd-sm">{key}</kbd>
                          {/each}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/each}
              </Section>
            </div>
          {/if}
        </div>
      {:else}
        <div class="flex h-full items-center justify-center">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>
      {/if}
    </div>
  </div>
</main>

<Toasts />

<style>
  :global(.row-flash) {
    animation: -global-row-flash 1.4s ease-out;
  }

  @keyframes -global-row-flash {
    0%,
    55% {
      background-color: color-mix(
        in oklch,
        var(--color-primary) 22%,
        transparent
      );
    }
    100% {
      background-color: transparent;
    }
  }
</style>
