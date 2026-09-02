<script lang="ts">
  import Icon from "@iconify/svelte"
  import { getCurrentWindow } from "@tauri-apps/api/window"
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
    type Profile,
    saveDevice,
  } from "$lib/settings"
  import DockControls from "$lib/settings-ui/DockControls.svelte"
  import HotkeyPicker from "$lib/settings-ui/HotkeyPicker.svelte"
  import PresetGrid from "$lib/settings-ui/PresetGrid.svelte"
  import { allPresets } from "$lib/settings-ui/presets"
  import Row from "$lib/settings-ui/Row.svelte"
  import Section from "$lib/settings-ui/Section.svelte"
  import Segmented from "$lib/settings-ui/Segmented.svelte"
  import SyncPanel from "$lib/settings-ui/SyncPanel.svelte"
  import Toasts from "$lib/settings-ui/Toasts.svelte"
  import { applyAppearance } from "$lib/theme"

  const appWindow = getCurrentWindow()

  const steps = [
    { id: "welcome", title: "Welcome" },
    { id: "style", title: "Style" },
    { id: "dock", title: "Dock" },
    { id: "hotkeys", title: "Hotkeys" },
    { id: "sync", title: "Sync" },
    { id: "tips", title: "Tips" },
    { id: "done", title: "Done" },
  ]

  const tips = [
    {
      icon: "lucide:keyboard",
      title: "Win opens Eris",
      text: "Tap it anywhere. Win combos keep working.",
    },
    {
      icon: "lucide:terminal",
      title: "Type > to run",
      text: "A command runs straight from the search box.",
    },
    {
      icon: "lucide:clock",
      title: "Click the clock",
      text: "The calendar and your todo list slide out.",
    },
  ]

  const features = [
    {
      icon: "lucide:search",
      title: "Launcher",
      text: "Tap Win, type, press Enter. Apps, windows, todos, math, and the web.",
    },
    {
      icon: "lucide:panel-bottom",
      title: "Dock",
      text: "Pinned and running apps on a bar that replaces the Windows taskbar.",
    },
    {
      icon: "lucide:calendar-check",
      title: "Calendar and todos",
      text: "One click on the clock opens your day, your events, and your list.",
    },
  ]

  let at = $state(0)
  let device = $state<DeviceSettings>(structuredClone(defaultDevice))
  let profile = $state<Profile>(structuredClone(defaultProfile))
  let ready = $state(false)
  let finishing = $state(false)

  const load = async () => {
    const [d, p] = await Promise.all([ensureDevice(), loadProfile()])

    device = d
    profile = p
    at = 0
    ready = true
  }

  $effect(() => {
    load()

    const stop = onWindowShown("onboarding", load)

    return () => {
      stop.then(fn => fn())
    }
  })

  const appearanceJson = $derived(JSON.stringify(profile.appearance))

  $effect(() => {
    if (ready) {
      applyAppearance(JSON.parse(appearanceJson))
    }
  })

  const step = $derived(steps[at])
  const last = $derived(at === steps.length - 1)

  const presetName = $derived(
    allPresets([]).find(p => p.id === profile.presetId)?.name ?? "Custom",
  )

  const triggerLabel = $derived(
    {
      win: "Win key",
      shortcut: device.launcherShortcut,
      both: `Win key or ${device.launcherShortcut}`,
    }[device.launcherTrigger],
  )

  const finish = async () => {
    if (finishing) {
      return
    }

    finishing = true

    try {
      device.onboarded = true
      await saveDevice($state.snapshot(device))
      await saveProfileSynced($state.snapshot(profile))
      await setWinKeyCapture(device.launcherTrigger !== "shortcut").catch(
        () => undefined,
      )
      await setLauncherShortcut(
        device.launcherTrigger === "win" ? null : device.launcherShortcut,
      ).catch(() => undefined)
      await showWindow("main")
      await appWindow.hide()
    } finally {
      finishing = false
    }
  }

  const next = () => {
    if (last) {
      finish()
    } else {
      at += 1
    }
  }

  const skip = () => {
    at += 1
  }

  const back = () => {
    if (at > 0) {
      at -= 1
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" || e.defaultPrevented || finishing) {
      return
    }

    const target = e.target as HTMLElement | null

    if (target?.closest("input, button, select, textarea, dialog, a")) {
      return
    }

    e.preventDefault()
    next()
  }

  const summary = $derived([
    { icon: "lucide:palette", label: "Style", value: presetName },
    {
      icon: "lucide:panel-bottom",
      label: "Dock",
      value: `${device.dockStyle === "mac" ? "Mac" : "Windows"} style, ${device.dockEdge} edge${device.dockAutoHide ? ", auto-hide" : ""}`,
    },
    { icon: "lucide:keyboard", label: "Launcher", value: triggerLabel },
    {
      icon: "lucide:refresh-cw",
      label: "Sync",
      value: device.sync.enabled && device.sync.url ? device.sync.url : "Off",
    },
  ])
</script>

<svelte:window {onkeydown} />

<main class="flex min-h-0 grow flex-col">
  <header
    data-tauri-drag-region
    class="flex items-center gap-4 px-6 pt-5 pb-3"
  >
    <div class="pointer-events-none flex items-center gap-2">
      <div
        class="flex size-7 items-center justify-center rounded-field bg-primary/15 text-primary"
      >
        <Icon icon="lucide:sparkles" class="size-4" />
      </div>

      <span class="text-sm font-semibold">Eris setup</span>
    </div>

    <span data-tauri-drag-region class="grow"></span>

    <ol class="flex items-center gap-2" aria-label="Progress">
      {#each steps as s, i (s.id)}
        <li class="flex">
          <button
            type="button"
            class={[
              "h-1.5 rounded-full transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              i === at
                ? "w-6 bg-primary"
                : i < at
                  ? "w-1.5 bg-primary/50 hover:bg-primary/80"
                  : "w-1.5 bg-base-content/20 hover:bg-base-content/40",
            ]}
            aria-label={s.title}
            aria-current={i === at ? "step" : undefined}
            disabled={finishing}
            onclick={() => (at = i)}
          ></button>
        </li>
      {/each}
    </ol>

    <span data-tauri-drag-region class="grow"></span>

    <button
      type="button"
      class="btn btn-ghost btn-circle btn-sm"
      aria-label="Skip setup"
      title="Skip setup"
      disabled={finishing}
      onclick={finish}
    >
      <Icon icon="lucide:x" class="size-4" />
    </button>
  </header>

  <section class="min-h-0 grow overflow-y-auto px-8 py-2">
    {#if ready}
      {#key at}
        <div class="step flex h-full flex-col">
          {#if step.id === "welcome"}
            <div
              class="flex h-full flex-col items-center justify-center gap-8 text-center"
            >
              <div
                class="flex size-16 items-center justify-center rounded-box bg-primary/15 text-primary"
              >
                <Icon icon="lucide:sparkles" class="size-8" />
              </div>

              <div>
                <h2 class="text-3xl font-semibold tracking-tight">
                  Welcome to Eris
                </h2>

                <p class="mt-2 text-base text-base-content/70">
                  A launcher, a dock, and a calendar that live on your desktop.
                </p>
              </div>

              <ul class="grid w-full max-w-2xl grid-cols-3 gap-3 text-left">
                {#each features as f (f.title)}
                  <li
                    class="flex flex-col gap-2 rounded-box border border-base-content/10 bg-base-100/60 p-4 backdrop-blur-md"
                  >
                    <div
                      class="flex size-8 items-center justify-center rounded-field bg-primary/15 text-primary"
                    >
                      <Icon icon={f.icon} class="size-4" />
                    </div>

                    <span class="text-sm font-semibold">{f.title}</span>

                    <span class="text-xs text-base-content/60">{f.text}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {:else if step.id === "style"}
            <div class="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 class="text-2xl font-semibold tracking-tight">Pick a look</h2>

                <p class="text-sm text-base-content/60">
                  Changes preview live. Fine-tune every color later in settings.
                </p>
              </div>

              <Segmented
                label="Mode"
                bind:value={profile.appearance.mode}
                options={[
                  { value: "dark", label: "Dark", icon: "lucide:moon" },
                  { value: "light", label: "Light", icon: "lucide:sun" },
                  { value: "system", label: "System", icon: "lucide:monitor" },
                ]}
              />
            </div>

            <PresetGrid bind:profile />
          {:else if step.id === "dock"}
            <div class="mb-4">
              <h2 class="text-2xl font-semibold tracking-tight">Shape the dock</h2>

              <p class="text-sm text-base-content/60">
                Fine-tune sizes and contents later in settings.
              </p>
            </div>

            <div class="grid grid-cols-[1fr_16rem] items-start gap-5">
              <Section title="Dock">
                <DockControls bind:device subset />
              </Section>

              <div class="flex flex-col gap-2">
                <div
                  class="relative aspect-[16/10] w-full overflow-hidden rounded-box border border-base-content/10 bg-linear-to-br from-primary/25 via-base-200 to-secondary/20"
                >
                  {#if !device.hideSystemTaskbar}
                    <div
                      class="absolute inset-x-0 bottom-0 h-[8%] bg-base-content/15"
                    ></div>
                  {/if}

                  <div
                    class={[
                      "absolute flex items-center justify-center gap-[3%] border border-base-content/10 bg-base-100/85 shadow-lg backdrop-blur-md transition-all duration-300",
                      device.dockStyle === "mac"
                        ? "left-1/2 w-3/5 -translate-x-1/2 rounded-full"
                        : "inset-x-0",
                      device.dockEdge === "top"
                        ? device.dockStyle === "mac"
                          ? "top-[2%]"
                          : "top-0"
                        : device.hideSystemTaskbar
                          ? device.dockStyle === "mac"
                            ? "bottom-[2%]"
                            : "bottom-0"
                          : device.dockStyle === "mac"
                            ? "bottom-[10%]"
                            : "bottom-[8%]",
                      device.dockAutoHide ? "h-[2%] opacity-60" : "h-[10%]",
                    ]}
                  >
                    {#if !device.dockAutoHide}
                      {#each [0, 1, 2, 3, 4] as dot (dot)}
                        <span
                          class={[
                            "aspect-square w-[5%] bg-primary/70",
                            device.dockStyle === "mac" ? "rounded-full" : "rounded-sm",
                          ]}
                        ></span>
                      {/each}
                    {/if}
                  </div>
                </div>

                <p class="text-center text-xs text-base-content/60">
                  {device.dockAutoHide
                    ? "Hidden until the cursor touches the edge"
                    : device.hideSystemTaskbar
                      ? "Eris replaces the Windows taskbar"
                      : "The Windows taskbar stays visible"}
                </p>
              </div>
            </div>
          {:else if step.id === "hotkeys"}
            <div class="mb-4">
              <h2 class="text-2xl font-semibold tracking-tight">Open Eris</h2>

              <p class="text-sm text-base-content/60">
                Choose how the launcher comes up.
              </p>
            </div>

            <div class="flex flex-col gap-4">
              <Section title="Launcher hotkey">
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

              <div
                class="flex items-start gap-3 rounded-box border border-base-content/10 bg-base-100/60 p-4 text-sm backdrop-blur-md"
              >
                <Icon icon="lucide:info" class="mt-0.5 size-4 shrink-0 text-primary" />

                <p class="text-base-content/80">
                  Tapping <kbd class="kbd kbd-sm">Win</kbd> alone opens Eris.
                  Combos such as <kbd class="kbd kbd-sm">Win</kbd> +
                  <kbd class="kbd kbd-sm">E</kbd> keep working as usual.
                </p>
              </div>
            </div>
          {:else if step.id === "sync"}
            <div class="mb-4">
              <h2 class="text-2xl font-semibold tracking-tight">Sync across devices</h2>

              <p class="text-sm text-base-content/60">
                Optional. Point Eris at your own sync server, or skip and set it
                up later.
              </p>
            </div>

            <div class="flex flex-col gap-4">
              <SyncPanel bind:device compact />
            </div>
          {:else if step.id === "tips"}
            <div
              class="flex h-full flex-col items-center justify-center gap-8 text-center"
            >
              <div>
                <h2 class="text-3xl font-semibold tracking-tight">A few tips</h2>

                <p class="mt-2 text-base text-base-content/70">
                  Three things worth knowing before you start.
                </p>
              </div>

              <ul class="grid w-full max-w-2xl grid-cols-3 gap-3 text-left">
                {#each tips as t (t.title)}
                  <li
                    class="flex flex-col gap-2 rounded-box border border-base-content/10 bg-base-100/60 p-4 backdrop-blur-md"
                  >
                    <div
                      class="flex size-8 items-center justify-center rounded-field bg-primary/15 text-primary"
                    >
                      <Icon icon={t.icon} class="size-4" />
                    </div>

                    <span class="text-sm font-semibold">{t.title}</span>

                    <span class="text-xs text-base-content/60">{t.text}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {:else}
            <div
              class="flex h-full flex-col items-center justify-center gap-8 text-center"
            >
              <div
                class="flex size-16 items-center justify-center rounded-box bg-success/15 text-success"
              >
                <Icon icon="lucide:check" class="size-8" />
              </div>

              <div>
                <h2 class="text-3xl font-semibold tracking-tight">All set</h2>

                <p class="mt-2 text-base text-base-content/70">
                  Everything below can change later in settings.
                </p>
              </div>

              <ul
                class="w-full max-w-md divide-y divide-base-content/10 rounded-box border border-base-content/10 bg-base-100/60 text-left backdrop-blur-md"
              >
                {#each summary as s (s.label)}
                  <li class="flex items-center gap-3 px-4 py-3">
                    <Icon icon={s.icon} class="size-4 shrink-0 text-primary" />

                    <span class="w-20 text-sm text-base-content/60">{s.label}</span>

                    <span class="truncate text-sm font-medium">{s.value}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/key}
    {:else}
      <div class="flex h-full items-center justify-center">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>
    {/if}
  </section>

  <footer class="flex items-center justify-between px-6 pt-3 pb-5">
    <button
      type="button"
      class="btn btn-ghost btn-sm"
      disabled={at === 0 || finishing}
      onclick={back}
    >
      <Icon icon="lucide:arrow-left" class="size-4" />
      Back
    </button>

    <div class="flex items-center gap-2">
      <span class="mr-2 hidden text-xs text-base-content/50 sm:inline">
        Enter continues
      </span>

      {#if at > 0 && !last}
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          disabled={finishing}
          onclick={skip}
        >
          Skip
        </button>
      {/if}

      <button
        type="button"
        class="btn btn-primary btn-sm"
        disabled={!ready || finishing}
        onclick={next}
      >
        {#if finishing}
          <span class="loading loading-spinner loading-xs"></span>
        {/if}

        {at === 0 ? "Get started" : last ? "Start using Eris" : "Next"}

        {#if !last && !finishing}
          <Icon icon="lucide:arrow-right" class="size-4" />
        {/if}
      </button>
    </div>
  </footer>
</main>

<Toasts />

<style>
  .step {
    animation: rise 220ms ease-out;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>
