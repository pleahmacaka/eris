<script lang="ts">
  import Icon from "@iconify/svelte"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import {
    applyAppearance,
    defaults,
    loadSettings,
    saveSettings,
    type Settings,
  } from "$lib/settings"

  const appWindow = getCurrentWindow()

  let settings = $state<Settings>({ ...defaults })
  let ready = $state(false)

  loadSettings().then(value => {
    settings = value
    ready = true
  })

  $effect(() => {
    if (!ready) return

    applyAppearance(settings)
    saveSettings($state.snapshot(settings))
  })
</script>

<main class="flex h-full flex-col gap-4 p-5">
  <header data-tauri-drag-region class="flex items-center justify-between">
    <h1 class="text-lg font-semibold">Settings</h1>

    <button
      class="btn btn-ghost btn-sm btn-circle"
      aria-label="Close"
      onclick={() => appWindow.hide()}
    >
      <Icon icon="lucide:x" class="size-4" />
    </button>
  </header>

  <section class="flex flex-col gap-3">
    <h2 class="text-xs font-medium uppercase tracking-wide opacity-60">Dock</h2>

    <div class="join w-full">
      <button
        class="btn join-item grow"
        class:btn-primary={settings.dockStyle === "windows"}
        onclick={() => (settings.dockStyle = "windows")}
      >
        Windows
      </button>

      <button
        class="btn join-item grow"
        class:btn-primary={settings.dockStyle === "mac"}
        onclick={() => (settings.dockStyle = "mac")}
      >
        Mac
      </button>
    </div>

    <label class="flex flex-col gap-1">
      <span class="text-sm">Height {settings.dockHeight}</span>

      <input
        type="range"
        class="range range-sm range-primary"
        min="32"
        max="88"
        step="2"
        bind:value={settings.dockHeight}
      />
    </label>

    {#if settings.dockStyle === "mac"}
      <label class="flex flex-col gap-1">
        <span class="text-sm">Width {settings.dockWidth}</span>

        <input
          type="range"
          class="range range-sm range-primary"
          min="320"
          max="1400"
          step="20"
          bind:value={settings.dockWidth}
        />
      </label>
    {/if}

    <label class="flex items-center justify-between gap-3">
      <span class="text-sm">Hide Windows taskbar</span>

      <input
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked={settings.hideSystemTaskbar}
      />
    </label>
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="text-xs font-medium uppercase tracking-wide opacity-60">Appearance</h2>

    <label class="flex items-center justify-between gap-3">
      <span class="text-sm">Follow Windows accent color</span>

      <input
        type="checkbox"
        class="toggle toggle-primary"
        bind:checked={settings.useSystemAccent}
      />
    </label>

    <label class="flex flex-col gap-1" class:opacity-40={settings.useSystemAccent}>
      <span class="text-sm">Color {settings.accentHue}</span>

      <input
        type="range"
        class="range range-sm range-primary"
        min="0"
        max="360"
        step="1"
        disabled={settings.useSystemAccent}
        bind:value={settings.accentHue}
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-sm">Vividness {Math.round(settings.vividness * 100)}</span>

      <input
        type="range"
        class="range range-sm range-primary"
        min="0"
        max="0.3"
        step="0.01"
        bind:value={settings.vividness}
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-sm">Color spread {settings.accentSpread}</span>

      <input
        type="range"
        class="range range-sm range-primary"
        min="0"
        max="120"
        step="2"
        bind:value={settings.accentSpread}
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-sm">Texture {Math.round(settings.texture * 100)}</span>

      <input
        type="range"
        class="range range-sm range-primary"
        min="0"
        max="1"
        step="0.05"
        bind:value={settings.texture}
      />
    </label>
  </section>
</main>
