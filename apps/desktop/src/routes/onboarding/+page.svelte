<script lang="ts">
  import * as native from "$lib/native"
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { saveProfileSynced } from "$lib/data"
  import { ensureDevice } from "$lib/device"
  import { onWindowShown, showWindow } from "$lib/native/windows"
  import { setLauncherShortcut, setWinKeyCapture } from "$lib/native/dock"
  import {
    type DeviceSettings,
    defaultDevice,
    defaultProfile,
    loadProfile,
    type Profile,
    saveDevice,
  } from "@eris/settings"
  import {
    DockControls,
    FeatureControls,
    HotkeyPicker,
    PresetGrid,
    allPresets,
    SyncPanel,
  } from "$lib/settings-ui"
  import { Row, Section, Segmented, Toasts } from "@eris/ui"
  import { applyAppearance } from "$lib/theme"

  const steps = [
    "welcome",
    "features",
    "style",
    "dock",
    "hotkeys",
    "sync",
    "tips",
    "done",
  ]

  const tips = [
    { id: "win", icon: "lucide:keyboard" },
    { id: "run", icon: "lucide:terminal" },
    { id: "clock", icon: "lucide:clock" },
  ]

  const features = [
    { id: "launcher", icon: "lucide:search" },
    { id: "dock", icon: "lucide:panel-bottom" },
    { id: "calendar", icon: "lucide:calendar-check" },
  ]

  const kbd = (key: string) => `<kbd class="kbd kbd-sm">${key}</kbd>`

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
    allPresets([]).find(p => p.id === profile.presetId)?.name ??
      $t("onboarding.custom"),
  )

  const triggerLabel = $derived(
    {
      win: $t("settings.options.win"),
      shortcut: device.launcherShortcut,
      both: $t("onboarding.hotkeys.winOr", {
        values: { shortcut: device.launcherShortcut },
      }),
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
      await native.hideWindow("onboarding")
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
    {
      icon: "lucide:palette",
      label: $t("onboarding.steps.style"),
      value: presetName,
    },
    {
      icon: "lucide:panel-bottom",
      label: $t("onboarding.steps.dock"),
      value: $t("onboarding.done.dockValue", {
        values: {
          style: $t(`settings.dock.styles.${device.dockStyle}.label`),
          edge: $t(`onboarding.done.edges.${device.dockEdge}`),
          autoHide: device.dockAutoHide ? "yes" : "no",
        },
      }),
    },
    {
      icon: "lucide:keyboard",
      label: $t("onboarding.welcome.launcher.title"),
      value: triggerLabel,
    },
    {
      icon: "lucide:refresh-cw",
      label: $t("onboarding.steps.sync"),
      value:
        device.sync.enabled && device.sync.url
          ? device.sync.url
          : $t("common.off"),
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

      <span class="text-sm font-semibold">{$t("onboarding.title")}</span>
    </div>

    <span data-tauri-drag-region class="grow"></span>

    <ol class="flex items-center gap-2" aria-label={$t("onboarding.progressAria")}>
      {#each steps as s, i (s)}
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
            aria-label={$t(`onboarding.steps.${s}`)}
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
      aria-label={$t("onboarding.skipSetup")}
      title={$t("onboarding.skipSetup")}
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
          {#if step === "welcome"}
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
                  {$t("onboarding.welcome.title")}
                </h2>

                <p class="mt-2 text-base text-base-content/70">
                  {$t("onboarding.welcome.tagline")}
                </p>
              </div>

              <ul class="grid w-full max-w-2xl grid-cols-3 gap-3 text-left">
                {#each features as f (f.id)}
                  <li
                    class="flex flex-col gap-2 rounded-box border border-base-content/10 bg-base-100/60 p-4 backdrop-blur-md"
                  >
                    <div
                      class="flex size-8 items-center justify-center rounded-field bg-primary/15 text-primary"
                    >
                      <Icon icon={f.icon} class="size-4" />
                    </div>

                    <span class="text-sm font-semibold">
                      {$t(`onboarding.welcome.${f.id}.title`)}
                    </span>

                    <span class="text-xs text-base-content/60">
                      {$t(`onboarding.welcome.${f.id}.text`)}
                    </span>
                  </li>
                {/each}
              </ul>
            </div>
          {:else if step === "features"}
            <div class="mb-4">
              <h2 class="text-2xl font-semibold tracking-tight">
                {$t("onboarding.features.title")}
              </h2>

              <p class="text-sm text-base-content/60">
                {$t("onboarding.features.blurb")}
              </p>
            </div>

            <Section title={$t("settings.groups.features.title")}>
              <FeatureControls bind:device presets />
            </Section>
          {:else if step === "style"}
            <div class="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 class="text-2xl font-semibold tracking-tight">
                  {$t("onboarding.style.title")}
                </h2>

                <p class="text-sm text-base-content/60">
                  {$t("onboarding.style.blurb")}
                </p>
              </div>

              <Segmented
                label={$t("settings.rows.mode")}
                bind:value={profile.appearance.mode}
                options={[
                  { value: "dark", label: $t("settings.options.dark"), icon: "lucide:moon" },
                  { value: "light", label: $t("settings.options.light"), icon: "lucide:sun" },
                  { value: "system", label: $t("settings.options.system"), icon: "lucide:monitor" },
                ]}
              />
            </div>

            <PresetGrid bind:profile />
          {:else if step === "dock"}
            <div class="mb-4">
              <h2 class="text-2xl font-semibold tracking-tight">
                {$t("onboarding.dock.title")}
              </h2>

              <p class="text-sm text-base-content/60">
                {$t("onboarding.dock.blurb")}
              </p>
            </div>

            <div class="grid grid-cols-[1fr_16rem] items-start gap-5">
              <Section title={$t("settings.groups.dock")}>
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
                    ? $t("onboarding.dock.autoHide")
                    : device.hideSystemTaskbar
                      ? $t("onboarding.dock.replaces")
                      : $t("onboarding.dock.taskbarStays")}
                </p>
              </div>
            </div>
          {:else if step === "hotkeys"}
            <div class="mb-4">
              <h2 class="text-2xl font-semibold tracking-tight">
                {$t("onboarding.hotkeys.title")}
              </h2>

              <p class="text-sm text-base-content/60">
                {$t("onboarding.hotkeys.blurb")}
              </p>
            </div>

            <div class="flex flex-col gap-4">
              <Section title={$t("settings.groups.hotkey.title")}>
                <Row
                  label={$t("settings.rows.openWith")}
                  hint={$t("settings.hints.openWith")}
                >
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
                  <Row
                    label={$t("settings.rows.shortcut")}
                    hint={$t("settings.hints.shortcut")}
                  >
                    <HotkeyPicker bind:value={device.launcherShortcut} />
                  </Row>
                {/if}
              </Section>

              <div
                class="flex items-start gap-3 rounded-box border border-base-content/10 bg-base-100/60 p-4 text-sm backdrop-blur-md"
              >
                <Icon icon="lucide:info" class="mt-0.5 size-4 shrink-0 text-primary" />

                <p class="text-base-content/80">
                  {@html $t("onboarding.hotkeys.info", {
                    values: { win: kbd("Win"), e: kbd("E") },
                  })}
                </p>
              </div>
            </div>
          {:else if step === "sync"}
            <div class="mb-4">
              <h2 class="text-2xl font-semibold tracking-tight">
                {$t("onboarding.sync.title")}
              </h2>

              <p class="text-sm text-base-content/60">
                {$t("onboarding.sync.blurb")}
              </p>
            </div>

            <div class="flex flex-col gap-4">
              <SyncPanel bind:device compact />
            </div>
          {:else if step === "tips"}
            <div
              class="flex h-full flex-col items-center justify-center gap-8 text-center"
            >
              <div>
                <h2 class="text-3xl font-semibold tracking-tight">
                  {$t("onboarding.tips.title")}
                </h2>

                <p class="mt-2 text-base text-base-content/70">
                  {$t("onboarding.tips.blurb")}
                </p>
              </div>

              <ul class="grid w-full max-w-2xl grid-cols-3 gap-3 text-left">
                {#each tips as tip (tip.id)}
                  <li
                    class="flex flex-col gap-2 rounded-box border border-base-content/10 bg-base-100/60 p-4 backdrop-blur-md"
                  >
                    <div
                      class="flex size-8 items-center justify-center rounded-field bg-primary/15 text-primary"
                    >
                      <Icon icon={tip.icon} class="size-4" />
                    </div>

                    <span class="text-sm font-semibold">
                      {$t(`onboarding.tips.${tip.id}.title`)}
                    </span>

                    <span class="text-xs text-base-content/60">
                      {$t(`onboarding.tips.${tip.id}.text`)}
                    </span>
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
                <h2 class="text-3xl font-semibold tracking-tight">
                  {$t("onboarding.done.title")}
                </h2>

                <p class="mt-2 text-base text-base-content/70">
                  {$t("onboarding.done.blurb")}
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
      {$t("common.back")}
    </button>

    <div class="flex items-center gap-2">
      <span class="mr-2 hidden text-xs text-base-content/50 sm:inline">
        {$t("onboarding.enterContinues")}
      </span>

      {#if at > 0 && !last}
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          disabled={finishing}
          onclick={skip}
        >
          {$t("common.skip")}
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

        {at === 0
          ? $t("onboarding.getStarted")
          : last
            ? $t("onboarding.startUsing")
            : $t("common.next")}

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
