<script lang="ts">
  import * as native from "$lib/native"
  import Icon from "@iconify/svelte"
  import { tick } from "svelte"
  import { emit, listen } from "@tauri-apps/api/event"
  import { disable, enable } from "@tauri-apps/plugin-autostart"
  import { saveProfileSynced } from "$lib/data/store"
  import { ensureDevice } from "$lib/device"
  import { onWindowShown, showWindow } from "$lib/native/windows"
  import { setLauncherShortcut, setWinKeyCapture } from "$lib/native/dock"
  import {
    type DeviceSettings,
    defaultDevice,
    defaultProfile,
    loadProfile,
    onDevice,
    onProfile,
    type Profile,
    saveDevice,
  } from "@eris/settings"
  import Advanced from "$lib/settings-ui/Advanced.svelte"
  import AppearanceControls from "$lib/settings-ui/AppearanceControls.svelte"
  import DockControls from "$lib/settings-ui/DockControls.svelte"
  import FeatureControls from "$lib/settings-ui/FeatureControls.svelte"
  import { getVersion } from "@tauri-apps/api/app"
  import { relaunch } from "@tauri-apps/plugin-process"
  import { check, type Update } from "@tauri-apps/plugin-updater"
  import HotkeyPicker from "$lib/settings-ui/HotkeyPicker.svelte"
  import ImportExport from "$lib/settings-ui/ImportExport.svelte"
  import PresetGrid from "$lib/settings-ui/PresetGrid.svelte"
  import { Row, Section, Segmented, Toasts } from "@eris/ui"
  import SyncPanel from "$lib/settings-ui/SyncPanel.svelte"
  import { stableJson } from "$lib/settings-ui/json"
  import {
    searchRows,
    searchSections,
    type SearchEntry,
    type SectionId,
    sections,
  } from "$lib/settings-ui/search"
  import { toast } from "@eris/ui"
  import { applyAppearance } from "$lib/theme"
  import { t } from "svelte-i18n"
  import { LANGUAGES } from "@eris/i18n"

  let version = $state("")

  $effect(() => {
    getVersion()
      .then(v => (version = v))
      .catch(() => undefined)
  })

  type UpdateState = "idle" | "checking" | "none" | "available" | "downloading" | "installing" | "failed"

  let update = $state<Update | null>(null)
  let updateState = $state<UpdateState>("idle")
  let updateError = $state("")
  let downloaded = $state(0)
  let downloadTotal = $state(0)

  const downloadPercent = $derived(
    downloadTotal > 0 ? Math.min(100, Math.round((downloaded / downloadTotal) * 100)) : 0,
  )

  const checkUpdates = async () => {
    updateState = "checking"
    updateError = ""

    try {
      update = await check()
      updateState = update ? "available" : "none"
    } catch (e) {
      updateError = String(e)
      updateState = "failed"
    }
  }

  const installUpdate = async () => {
    if (!update) {
      return
    }

    updateState = "downloading"
    downloaded = 0
    downloadTotal = 0

    try {
      await update.downloadAndInstall(event => {
        if (event.event === "Started") {
          downloadTotal = event.data.contentLength ?? 0
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength
        } else {
          updateState = "installing"
        }
      })

      await relaunch()
    } catch (e) {
      updateError = String(e)
      updateState = "failed"
    }
  }
  const reminders = [0, 5, 10, 15, 30, 60]

  let section = $state<SectionId>("general")
  let snapTimer: ReturnType<typeof setTimeout> | undefined

  const previewSnap = () => {
    clearTimeout(snapTimer)
    emit("chat-snap-preview", { percent: device.chatSnap, on: true }).catch(() => undefined)
    snapTimer = setTimeout(() => {
      emit("chat-snap-preview", { percent: device.chatSnap, on: false }).catch(() => undefined)
    }, 1500)
  }
  let query = $state("")
  let device = $state<DeviceSettings>(structuredClone(defaultDevice))
  let profile = $state<Profile>(structuredClone(defaultProfile))
  let ready = $state(false)
  let scroller = $state<HTMLElement>()
  let deviceJson = ""
  let profileJson = ""

  const found = $derived(searchRows(query, $t))
  const visible = $derived(searchSections(query, $t))

  const jump = async (entry: SearchEntry) => {
    section = entry.section
    await tick()

    const row = scroller?.querySelector<HTMLElement>(
      `[data-row="${$t(entry.key)}"]`,
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
      toast(
        $t("settings.toasts.shortcutFailed", { values: { error: message(error) } }),
        "error",
      ),
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
      toast(
        $t("settings.toasts.autostartFailed", { values: { error: message(error) } }),
        "error",
      )
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
      native.hideWindow("settings")
    }
  }

  const chips = (shortcut: string) =>
    shortcut.split("+").map(part => (part === "Super" ? "Win" : part))

  const key = (name: string) => $t(`settings.shortcuts.keys.${name}`)

  const shortcuts = $derived([
    {
      title: $t("settings.shortcuts.launcher"),
      items: [
        ...(device.launcherTrigger !== "shortcut"
          ? [{ keys: ["Win"], action: $t("settings.shortcuts.openLauncher") }]
          : []),
        ...(device.launcherTrigger !== "win"
          ? [
              {
                keys: chips(device.launcherShortcut),
                action: $t("settings.shortcuts.openLauncher"),
              },
            ]
          : []),
        { keys: [key("up"), key("down")], action: $t("settings.shortcuts.moveSelection") },
        { keys: [key("pageUp"), key("pageDown")], action: $t("settings.shortcuts.movePage") },
        { keys: ["Tab"], action: $t("settings.shortcuts.nextGroup") },
        { keys: ["Shift", "Tab"], action: $t("settings.shortcuts.previousGroup") },
        { keys: ["Enter"], action: $t("settings.shortcuts.openResult") },
        { keys: ["Shift", "Enter"], action: $t("settings.shortcuts.openAdmin") },
        { keys: ["Ctrl", "Enter"], action: $t("settings.shortcuts.openLocation") },
        { keys: ["Alt", "1-9"], action: $t("settings.shortcuts.openNumbered") },
        { keys: [key("menu")], action: $t("settings.shortcuts.actionMenu") },
        { keys: ["Esc"], action: $t("settings.shortcuts.clearThenClose") },
      ],
    },
    {
      title: $t("settings.shortcuts.chat"),
      items: [{ keys: chips(device.chatShortcut), action: $t("settings.shortcuts.toggleChat") }],
    },
    {
      title: $t("settings.shortcuts.panel"),
      items: [
        { keys: [key("left"), key("right")], action: $t("settings.shortcuts.switchTabs") },
        { keys: [key("arrows")], action: $t("settings.shortcuts.moveDay") },
        { keys: ["Enter"], action: $t("settings.shortcuts.addEvent") },
        { keys: ["F2"], action: $t("settings.shortcuts.renameTodo") },
        { keys: ["Ctrl", "Enter"], action: $t("settings.shortcuts.saveEvent") },
        { keys: ["Esc"], action: $t("settings.shortcuts.closePanel") },
      ],
    },
    {
      title: $t("settings.shortcuts.setup"),
      items: [
        { keys: ["Enter"], action: $t("settings.shortcuts.nextStep") },
        { keys: ["Esc"], action: $t("settings.shortcuts.closeWindow") },
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

      <h1 class="text-base font-semibold">{$t("settings.title")}</h1>
    </div>

    <span data-tauri-drag-region class="grow"></span>

    <button
      type="button"
      class="btn btn-ghost btn-circle btn-sm"
      aria-label={$t("common.close")}
      onclick={() => native.hideWindow("settings")}
    >
      <Icon icon="lucide:x" class="size-4" />
    </button>
  </header>

  <div class="flex min-h-0 grow">
    <nav class="w-44 shrink-0 px-3 pb-4" aria-label={$t("settings.sectionsAria")}>
      <label class="input input-sm mb-2 w-full">
        <Icon icon="lucide:search" class="size-3.5 shrink-0 opacity-50" />

        <input
          type="search"
          placeholder={$t("common.search")}
          aria-label={$t("settings.searchAria")}
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
          {@const label = $t(`settings.sections.${s.id}.label`)}

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
              {label}
            </button>

            {#if rows.length}
              <ul>
                {#each rows as r (r.key)}
                  <li>
                    <button
                      type="button"
                      class="rounded-field text-xs text-base-content/70"
                      onclick={() => jump(r)}
                    >
                      {$t(r.key)}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>

      {#if !visible.length}
        <p class="px-2 py-1 text-xs text-base-content/50">{$t("common.noMatches")}</p>
      {/if}
    </nav>

    <div bind:this={scroller} class="min-h-0 grow overflow-y-auto px-5 pb-6">
      {#if ready}
        <div class="mb-4">
          <h2 class="text-xl font-semibold tracking-tight">
            {$t(`settings.sections.${section}.label`)}
          </h2>

          <p class="text-sm text-base-content/60">{$t(`settings.sections.${section}.blurb`)}</p>
        </div>

        <div class="flex flex-col gap-4">
          {#if section === "general"}
            <Section title={$t("settings.groups.device")}>
              <Row label={$t("settings.rows.deviceName")} hint={$t("settings.hints.deviceName")}>
                <input
                  class="input input-sm w-52"
                  aria-label={$t("settings.rows.deviceName")}
                  autocomplete="off"
                  spellcheck="false"
                  bind:value={device.deviceName}
                />
              </Row>

              <Row label={$t("settings.rows.autostart")} hint={$t("settings.hints.autostart")}>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label={$t("settings.rows.autostart")}
                  checked={device.autostart}
                  onchange={e => setAutostart(e.currentTarget.checked)}
                />
              </Row>

              <Row label={$t("settings.rows.hideTaskbar")} hint={$t("settings.hints.hideTaskbar")}>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label={$t("settings.rows.hideTaskbar")}
                  bind:checked={device.hideSystemTaskbar}
                />
              </Row>

              <Row label={$t("settings.rows.language")} hint={$t("settings.hints.language")}>
                <select
                  class="select select-sm w-40"
                  aria-label={$t("settings.rows.language")}
                  bind:value={device.language}
                >
                  {#each LANGUAGES as language (language)}
                    <option value={language}>{$t(`languages.${language}`)}</option>
                  {/each}
                </select>
              </Row>

              <Row label={$t("settings.rows.setupWizard")} hint={$t("settings.hints.setupWizard")}>
                <button
                  type="button"
                  class="btn btn-soft btn-sm"
                  onclick={resetOnboarding}
                >
                  {$t("settings.options.runSetup")}
                </button>
              </Row>
            </Section>

            <Section
              title={$t("settings.groups.features.title")}
              description={$t("settings.groups.features.description")}
            >
              <FeatureControls bind:device />
            </Section>

            {#if device.features.chat}
              <Section
                title={$t("settings.groups.chat.title")}
                description={$t("settings.groups.chat.description")}
              >
                <Row label={$t("settings.rows.snapDistance")} value="{device.chatSnap}%" stacked>
                  <input
                    type="range"
                    class="range range-primary range-xs w-full"
                    min="5"
                    max="40"
                    step="1"
                    aria-label={$t("settings.rows.snapDistance")}
                    bind:value={device.chatSnap}
                    oninput={previewSnap}
                  />
                </Row>

                <Row label={$t("settings.rows.chatModel")} hint={$t("settings.hints.chatModel")}>
                  <input
                    class="input input-sm w-40"
                    list="settings-chat-models"
                    placeholder={$t("chat.config.modelDefault")}
                    aria-label={$t("settings.rows.chatModel")}
                    bind:value={device.chatModel}
                  />

                  <datalist id="settings-chat-models">
                    {#each ["fable", "opus", "sonnet", "haiku", "opus[1m]", "sonnet[1m]"] as model (model)}
                      <option value={model}></option>
                    {/each}
                  </datalist>
                </Row>

                <Row label={$t("settings.rows.chatEffort")} hint={$t("settings.hints.chatEffort")} tag="partial">
                  <select
                    class="select select-sm w-40"
                    aria-label={$t("settings.rows.chatEffort")}
                    bind:value={device.chatEffort}
                  >
                    {#each ["", "low", "medium", "high", "xhigh", "max"] as effort (effort)}
                      <option value={effort}>{$t(`chat.effort.${effort || "default"}`)}</option>
                    {/each}
                  </select>
                </Row>

                <Row label={$t("settings.rows.chatPermission")} hint={$t("settings.hints.chatPermission")}>
                  <select
                    class="select select-sm w-40"
                    aria-label={$t("settings.rows.chatPermission")}
                    bind:value={device.chatPermission}
                  >
                    {#each ["default", "acceptEdits", "plan", "auto", "dontAsk", "bypassPermissions"] as mode (mode)}
                      <option value={mode}>{$t(`chat.permission.${mode}`)}</option>
                    {/each}
                  </select>
                </Row>

                <Row label={$t("settings.rows.chatThinking")} hint={$t("settings.hints.chatThinking")} tag="partial">
                  <select
                    class="select select-sm w-40"
                    aria-label={$t("settings.rows.chatThinking")}
                    bind:value={device.chatThinking}
                  >
                    {#each ["default", "on", "off"] as tri (tri)}
                      <option value={tri}>{$t(`chat.tri.${tri}`)}</option>
                    {/each}
                  </select>
                </Row>

                <Row label={$t("settings.rows.chatAutoCompact")} hint={$t("settings.hints.chatAutoCompact")} tag="partial">
                  <select
                    class="select select-sm w-40"
                    aria-label={$t("settings.rows.chatAutoCompact")}
                    bind:value={device.chatAutoCompact}
                  >
                    {#each ["default", "on", "off"] as tri (tri)}
                      <option value={tri}>{$t(`chat.tri.${tri}`)}</option>
                    {/each}
                  </select>
                </Row>

                <Row label={$t("settings.rows.chatLanguage")} hint={$t("settings.hints.chatLanguage")} tag="partial">
                  <input
                    class="input input-sm w-40"
                    placeholder={$t("chat.config.languageDefault")}
                    aria-label={$t("settings.rows.chatLanguage")}
                    bind:value={device.chatLanguage}
                  />
                </Row>

                <Row label={$t("settings.rows.chatBudget")} hint={$t("settings.hints.chatBudget")} tag="partial">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    class="input input-sm w-40"
                    aria-label={$t("settings.rows.chatBudget")}
                    bind:value={device.chatBudget}
                  />
                </Row>

                <Row label={$t("settings.rows.chatSystemPrompt")} hint={$t("settings.hints.chatSystemPrompt")} tag="partial" stacked>
                  <textarea
                    class="textarea textarea-sm w-full"
                    rows="3"
                    aria-label={$t("settings.rows.chatSystemPrompt")}
                    bind:value={device.chatSystemPrompt}
                  ></textarea>
                </Row>

                <Row label={$t("settings.rows.chatHover")} hint={$t("settings.hints.chatHover")}>
                  <Segmented
                    label={$t("settings.rows.chatHover")}
                    bind:value={device.chatHover}
                    options={[
                      { value: "none", label: $t("chat.hover.none") },
                      { value: "title", label: $t("chat.hover.title") },
                      { value: "preview", label: $t("chat.hover.preview") },
                    ]}
                  />
                </Row>

                <Row label={$t("settings.rows.chatMultiBubble")} hint={$t("settings.hints.chatMultiBubble")} tag="partial">
                  <input
                    type="checkbox"
                    class="toggle toggle-primary"
                    aria-label={$t("settings.rows.chatMultiBubble")}
                    bind:checked={device.chatMultiBubble}
                  />
                </Row>

                <Row label={$t("settings.rows.chatBubbleColors")} hint={$t("settings.hints.chatBubbleColors")}>
                  <input
                    type="checkbox"
                    class="toggle toggle-primary"
                    aria-label={$t("settings.rows.chatBubbleColors")}
                    bind:checked={device.chatBubbleColors}
                  />
                </Row>

                <Row label={$t("settings.rows.chatQueueMode")} hint={$t("settings.hints.chatQueueMode")}>
                  <Segmented
                    label={$t("settings.rows.chatQueueMode")}
                    bind:value={device.chatQueueMode}
                    options={[
                      { value: "afterTool", label: $t("chat.queue.afterTool") },
                      { value: "afterReply", label: $t("chat.queue.afterReply") },
                    ]}
                  />
                </Row>
              </Section>
            {/if}

            <Section
              title={$t("settings.groups.hotkey.title")}
              description={$t("settings.groups.hotkey.description")}
            >
              <Row label={$t("settings.rows.openWith")} hint={$t("settings.hints.openWith")}>
                <Segmented
                  label={$t("settings.rows.openWith")}
                  bind:value={device.launcherTrigger}
                  options={[
                    { value: "win", label: $t("settings.options.win") },
                    { value: "shortcut", label: $t("settings.options.shortcut") },
                    { value: "both", label: $t("settings.options.both") },
                  ]}
                />
              </Row>

              {#if device.launcherTrigger !== "win"}
                <Row label={$t("settings.rows.shortcut")} hint={$t("settings.hints.shortcut")}>
                  <HotkeyPicker bind:value={device.launcherShortcut} />
                </Row>
              {/if}
            </Section>

            <Section
              title={$t("settings.groups.backup.title")}
              description={$t("settings.groups.backup.description")}
            >
              <ImportExport />
            </Section>
          {:else if section === "dock"}
            <Section title={$t("settings.groups.dock")}>
              <DockControls bind:device />
            </Section>

            <Section title={$t("settings.groups.tray")}>
              {#each ["showBluetooth", "showNotifications", "showDesktopButton", "showTaskView", "showInputLanguage"] as const as toggle (toggle)}
                <Row
                  label={$t(`settings.rows.${toggle}`)}
                  hint={$t(`settings.hints.${toggle}`)}
                  tag={toggle === "showBluetooth" || toggle === "showNotifications" ? "partial" : undefined}
                >
                  <input
                    type="checkbox"
                    class="toggle toggle-primary"
                    aria-label={$t(`settings.rows.${toggle}`)}
                    bind:checked={device[toggle]}
                  />
                </Row>
              {/each}
            </Section>
          {:else if section === "launcher"}
            <Section title={$t("settings.groups.results")}>
              <Row
                label={$t("settings.rows.resultsPerGroup")}
                value={String(profile.launcher.maxResults)}
                stacked
              >
                <input
                  type="range"
                  class="range range-primary range-xs w-full"
                  min="3"
                  max="15"
                  step="1"
                  aria-label={$t("settings.rows.resultsPerGroup")}
                  bind:value={profile.launcher.maxResults}
                />
              </Row>

              <Row label={$t("settings.rows.openWindows")} hint={$t("settings.hints.openWindows")}>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label={$t("settings.rows.openWindows")}
                  bind:checked={profile.launcher.showWindows}
                />
              </Row>

              <Row label={$t("settings.rows.commands")} hint={$t("settings.hints.commands")}>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label={$t("settings.rows.commands")}
                  bind:checked={profile.launcher.showCommands}
                />
              </Row>

              <Row label={$t("settings.rows.todos")} hint={$t("settings.hints.todos")}>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label={$t("settings.rows.todos")}
                  bind:checked={profile.launcher.showTodos}
                />
              </Row>

              <Row label={$t("settings.rows.calculator")} hint={$t("settings.hints.calculator")}>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label={$t("settings.rows.calculator")}
                  bind:checked={profile.launcher.calculator}
                />
              </Row>

              <Row label={$t("settings.rows.webSearch")} hint={$t("settings.hints.webSearch")}>
                <select
                  class="select select-sm w-40"
                  aria-label={$t("settings.rows.webSearch")}
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
            <Section
              title={$t("settings.groups.presets.title")}
              description={$t("settings.groups.presets.description")}
            >
              <div data-row={$t("settings.rows.presets")} class="p-4">
                <PresetGrid bind:profile />
              </div>
            </Section>

            <Section
              title={$t("settings.groups.fineTune.title")}
              description={$t("settings.groups.fineTune.description")}
            >
              <AppearanceControls bind:profile />
            </Section>
          {:else if section === "calendar"}
            <Section title={$t("settings.groups.calendar")}>
              <Row label={$t("settings.rows.weekStartsOn")}>
                <Segmented
                  label={$t("settings.rows.weekStartsOn")}
                  bind:value={profile.calendar.weekStartsOn}
                  options={[
                    { value: 1, label: $t("settings.options.monday") },
                    { value: 0, label: $t("settings.options.sunday") },
                  ]}
                />
              </Row>

              <Row label={$t("settings.rows.weekNumbers")} hint={$t("settings.hints.weekNumbers")}>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label={$t("settings.rows.weekNumbers")}
                  bind:checked={profile.calendar.showWeekNumbers}
                />
              </Row>

              <Row label={$t("settings.rows.defaultReminder")} hint={$t("settings.hints.defaultReminder")}>
                <select
                  class="select select-sm w-40"
                  aria-label={$t("settings.rows.defaultReminder")}
                  bind:value={profile.calendar.reminderMinutes}
                >
                  {#each reminders as minutes (minutes)}
                    <option value={minutes}>
                      {minutes === 0
                        ? $t("common.none")
                        : $t("settings.options.minBefore", { values: { minutes } })}
                    </option>
                  {/each}
                </select>
              </Row>
            </Section>

            <Section title={$t("settings.groups.todo")}>
              <Row label={$t("settings.rows.showCompleted")} hint={$t("settings.hints.showCompleted")}>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label={$t("settings.rows.showCompleted")}
                  bind:checked={profile.todo.showCompleted}
                />
              </Row>

              <Row label={$t("settings.rows.sortBy")}>
                <Segmented
                  label={$t("settings.rows.sortBy")}
                  bind:value={profile.todo.sortBy}
                  options={[
                    { value: "manual", label: $t("settings.options.manual") },
                    { value: "due", label: $t("settings.options.due") },
                    { value: "priority", label: $t("settings.options.priority") },
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
              <div data-row={$t("settings.rows.version")} class="flex items-center gap-4 px-4 py-4">
                <div
                  class="flex size-12 items-center justify-center rounded-box bg-primary/15 text-primary"
                >
                  <Icon icon="lucide:sparkles" class="size-6" />
                </div>

                <div class="flex flex-col">
                  <div class="flex items-center gap-2">
                    <span class="text-base font-semibold">Eris</span>

                    <span class="badge badge-soft badge-primary badge-sm">
                      {version}
                    </span>
                  </div>

                  <span class="text-sm text-base-content/60">
                    {$t("settings.about.tagline")}
                  </span>
                </div>
              </div>

              <Row label={$t("settings.rows.updates")} hint={$t("settings.hints.updates")} stacked>
                <div class="flex flex-wrap items-center gap-2">
                  {#if updateState === "available" && update}
                    <span class="text-sm">
                      {$t("settings.about.available", { values: { version: update.version } })}
                    </span>

                    <button type="button" class="btn btn-primary btn-sm" onclick={installUpdate}>
                      <Icon icon="lucide:download" class="size-4" />
                      {$t("settings.about.installRestart")}
                    </button>
                  {:else if updateState === "downloading" || updateState === "installing"}
                    <progress class="progress progress-primary w-40" value={downloadPercent} max="100"
                    ></progress>

                    <span class="text-sm text-base-content/70">
                      {updateState === "installing"
                        ? $t("settings.about.installing")
                        : $t("settings.about.downloading", { values: { percent: downloadPercent } })}
                    </span>
                  {:else}
                    <button
                      type="button"
                      class="btn btn-sm"
                      disabled={updateState === "checking"}
                      onclick={checkUpdates}
                    >
                      <Icon icon="lucide:refresh-cw" class={["size-4", updateState === "checking" && "animate-spin"]} />
                      {updateState === "checking"
                        ? $t("settings.about.checking")
                        : $t("settings.about.checkUpdates")}
                    </button>

                    {#if updateState === "none"}
                      <span class="text-sm text-success">{$t("settings.about.upToDate")}</span>
                    {:else if updateState === "failed"}
                      <span class="text-sm text-error">
                        {$t("settings.about.failed", { values: { error: updateError } })}
                      </span>
                    {/if}
                  {/if}
                </div>
              </Row>
            </Section>
          {:else if section === "keymap"}
            <Section
              title={$t("settings.groups.hotkey.title")}
              description={$t("settings.groups.hotkey.description")}
            >
              <Row label={$t("settings.rows.openWith")} hint={$t("settings.hints.openWith")}>
                <Segmented
                  label={$t("settings.rows.openWith")}
                  bind:value={device.launcherTrigger}
                  options={[
                    { value: "win", label: $t("settings.options.win") },
                    { value: "shortcut", label: $t("settings.options.shortcut") },
                    { value: "both", label: $t("settings.options.both") },
                  ]}
                />
              </Row>

              {#if device.launcherTrigger !== "win"}
                <Row label={$t("settings.rows.shortcut")} hint={$t("settings.hints.shortcut")}>
                  <HotkeyPicker bind:value={device.launcherShortcut} />
                </Row>
              {/if}
            </Section>

            <Section
              title={$t("settings.groups.chatHotkey.title")}
              description={$t("settings.groups.chatHotkey.description")}
            >
              <Row label={$t("settings.rows.chatShortcut")} hint={$t("settings.hints.chatShortcut")}>
                <HotkeyPicker bind:value={device.chatShortcut} fallback="Ctrl+Space" />
              </Row>
            </Section>

            <div data-row={$t("settings.rows.keyboardShortcuts")}>
              <Section
                title={$t("settings.groups.shortcuts.title")}
                description={$t("settings.groups.shortcuts.description")}
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
