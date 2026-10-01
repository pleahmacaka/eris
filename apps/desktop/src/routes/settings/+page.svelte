<script lang="ts">
  import * as native from "$lib/native"
  import Icon from "@iconify/svelte"
  import { emit } from "@tauri-apps/api/event"
  import { tick, untrack } from "svelte"
  import { saveProfileSynced } from "$lib/data"
  import { ensureDevice } from "$lib/device"
  import {
    onWindowHiding,
    onWindowShown,
    showWindow,
  } from "$lib/native/windows"
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
  import {
    AboutSection,
    AppearanceSection,
    CalendarSection,
    DataSection,
    DockSection,
    ExperimentalSection,
    GeneralSection,
    LauncherSection,
    SettingsNav,
    SyncPanel,
    TraySection,
    stableJson,
    type SearchEntry,
    type SectionId,
    sections,
  } from "$lib/settings-ui"
  import { Toasts } from "@eris/ui"
  import { toast } from "@eris/ui"
  import { applyAppearance } from "$lib/theme"
  import { t } from "svelte-i18n"

  let section = $state<SectionId>("general")
  let query = $state("")
  let device = $state<DeviceSettings>(structuredClone(defaultDevice))
  let profile = $state<Profile>(structuredClone(defaultProfile))
  let ready = $state(false)
  let scroller = $state<HTMLElement>()
  let deviceJson = ""
  let profileJson = ""
  let groups = $state<string[]>([])
  let activeGroup = $state<string | null>(null)

  const groupElements = () => [
    ...(scroller?.querySelectorAll<HTMLElement>("section[data-group]") ?? []),
  ]

  const collectGroups = () => {
    const next = groupElements().map(el => el.dataset.group ?? "")

    if (next.join("\n") !== groups.join("\n")) {
      groups = next
    }

    if (!activeGroup || !next.includes(activeGroup)) {
      activeGroup = next[0] ?? null
    }
  }

  const spyGroup = () => {
    if (!scroller) {
      return
    }

    const line = scroller.getBoundingClientRect().top + scroller.clientHeight / 3
    const atBottom =
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
    const passed = groupElements().filter(
      el => el.getBoundingClientRect().top <= line,
    )

    activeGroup = atBottom
      ? (groups.at(-1) ?? null)
      : (passed.at(-1)?.dataset.group ?? groups[0] ?? null)
  }

  const jumpGroup = (group: string) => {
    activeGroup = group
    scroller
      ?.querySelector<HTMLElement>(`section[data-group="${CSS.escape(group)}"]`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" })
  }

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

  const takeIntent = () => {
    native
      .takeIntent("settings")
      .then(intent => {
        if (intent && sections.some(s => s.id === intent)) {
          section = intent as SectionId
        }
      })
      .catch(() => undefined)
  }

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

  const flush = () => {
    if (!ready) {
      return
    }

    if (stableJson(device) !== deviceJson) {
      persistDevice()
    }

    if (stableJson(profile) !== profileJson) {
      persistProfile()
    }
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
      onWindowShown("settings", () => {
        query = ""
        takeIntent()
      }),
      onWindowHiding("settings", flush),
    ]

    takeIntent()

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
    `${device.features.launcher}|${device.launcherTrigger}|${device.launcherShortcut}`,
  )

  $effect(() => {
    const [launcher, trigger, shortcut] = hotkey.split("|")
    const on = launcher === "true"

    if (!ready) {
      return
    }

    setWinKeyCapture(on && trigger !== "shortcut").catch(() => undefined)
    setLauncherShortcut(on && trigger !== "win" ? shortcut : null).catch(error =>
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

  $effect(() => {
    if (!scroller) {
      return
    }

    const observer = new MutationObserver(collectGroups)

    observer.observe(scroller, { childList: true, subtree: true })
    untrack(collectGroups)

    return () => observer.disconnect()
  })

  $effect(() => {
    emit("dock-peek", section === "dock" || section === "tray").catch(
      () => undefined,
    )

    return () => {
      emit("dock-peek", false).catch(() => undefined)
    }
  })

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
    <SettingsNav bind:section bind:query onjump={jump} />

    <div
      bind:this={scroller}
      class="min-h-0 grow overflow-y-auto px-5 pb-6"
      onscroll={spyGroup}
    >
      {#if ready}
        <div class="mb-3">
          <h2 class="text-xl font-semibold tracking-tight">
            {$t(`settings.sections.${section}.label`)}
          </h2>

          <p class="text-sm text-base-content/60">{$t(`settings.sections.${section}.blurb`)}</p>
        </div>

        {#if groups.length > 1}
          <nav
            aria-label={$t("settings.tocAria")}
            class="sticky top-0 z-10 -mx-5 mb-3 flex flex-wrap gap-1.5 border-b border-base-content/10 bg-base-100/90 px-5 py-2 backdrop-blur-md"
          >
            {#each groups as group (group)}
              {@const active = activeGroup === group}

              <button
                type="button"
                class={[
                  "btn btn-xs rounded-full font-medium",
                  active ? "btn-primary" : "btn-ghost bg-base-content/5",
                ]}
                aria-current={active ? "true" : undefined}
                onclick={() => jumpGroup(group)}
              >
                {group}
              </button>
            {/each}
          </nav>
        {/if}

        <div class="flex flex-col gap-4">
          {#if section === "general"}
            <GeneralSection bind:device onreset={resetOnboarding} />
          {:else if section === "dock"}
            <DockSection bind:device bind:profile />
          {:else if section === "tray"}
            <TraySection bind:device />
          {:else if section === "launcher"}
            <LauncherSection bind:profile bind:device />
          {:else if section === "appearance"}
            <AppearanceSection bind:profile />
          {:else if section === "calendar"}
            <CalendarSection bind:profile bind:device />
          {:else if section === "sync"}
            <SyncPanel bind:device />
          {:else if section === "data"}
            <DataSection bind:device bind:profile />
          {:else if section === "about"}
            <AboutSection />
          {:else if section === "experimental"}
            <ExperimentalSection bind:device />
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
    animation: -global-row-flash 0.4s ease-out;
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
