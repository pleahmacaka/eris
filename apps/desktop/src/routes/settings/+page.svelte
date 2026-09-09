<script lang="ts">
  import * as native from "$lib/native"
  import Icon from "@iconify/svelte"
  import { tick } from "svelte"
  import { listen } from "@tauri-apps/api/event"
  import { saveProfileSynced } from "$lib/data"
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
  import {
    AboutSection,
    Advanced,
    AppearanceSection,
    CalendarSection,
    DockSection,
    GeneralSection,
    KeymapSection,
    LauncherSection,
    SettingsNav,
    SyncPanel,
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
            <GeneralSection bind:device onreset={resetOnboarding} />
          {:else if section === "dock"}
            <DockSection bind:device />
          {:else if section === "launcher"}
            <LauncherSection bind:profile />
          {:else if section === "appearance"}
            <AppearanceSection bind:profile />
          {:else if section === "calendar"}
            <CalendarSection bind:profile />
          {:else if section === "sync"}
            <SyncPanel bind:device />
          {:else if section === "advanced"}
            <Advanced bind:device bind:profile />
          {:else if section === "about"}
            <AboutSection />
          {:else if section === "keymap"}
            <KeymapSection bind:device />
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
