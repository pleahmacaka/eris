<script lang="ts">
  import Icon from "@iconify/svelte"
  import { invoke } from "@tauri-apps/api/core"
  import { Window } from "@tauri-apps/api/window"
  import { type AppEntry, appIcon, launchApp } from "$lib/apps"
  import { applyDock, loadSettings, onSettings, type Settings } from "$lib/settings"

  let pinned = $state<AppEntry[]>([])
  let settings = $state<Settings>()
  let now = $state(new Date())

  invoke<AppEntry[]>("pinned_apps").then(list => (pinned = list))

  const apply = (value: Settings) => {
    settings = value
    document.documentElement.dataset.dock = value.dockStyle
    applyDock(value)
  }

  $effect(() => {
    loadSettings().then(apply)

    const stop = onSettings(apply)

    return () => {
      stop.then(unlisten => unlisten())
    }
  })

  $effect(() => {
    const timer = setInterval(() => (now = new Date()), 1000)

    return () => clearInterval(timer)
  })

  const clock = $derived(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))

  const day = $derived(now.toLocaleDateString([], { month: "short", day: "numeric" }))

  const mac = $derived(settings?.dockStyle === "mac")

  const openWindow = async (label: string) => {
    const window = await Window.getByLabel(label)

    await window?.show()
    await window?.setFocus()
  }
</script>

<nav
  data-tauri-drag-region
  class="flex h-full items-center gap-1 px-2"
  class:justify-center={mac}
>
  <button
    class="btn btn-ghost btn-circle btn-sm"
    aria-label="Open launcher"
    onclick={() => openWindow("main")}
  >
    <Icon icon="lucide:sparkles" class="size-4 text-primary" />
  </button>

  <div class="divider divider-horizontal mx-0 h-6 self-center"></div>

  <div class="flex items-center gap-1" class:grow={!mac}>
    {#each pinned as app (app.path)}
      <button
        class="btn btn-ghost btn-sm btn-square"
        title={app.name}
        aria-label={app.name}
        onclick={() => launchApp(app.path)}
      >
        {#await appIcon(app.path) then icon}
          {#if icon}
            <img src={icon} alt="" class="size-5" />
          {:else}
            <Icon icon="lucide:app-window" class="size-4 opacity-70" />
          {/if}
        {/await}
      </button>
    {/each}
  </div>

  <div class="divider divider-horizontal mx-0 h-6 self-center"></div>

  <button
    class="btn btn-ghost btn-circle btn-sm"
    aria-label="Open settings"
    onclick={() => openWindow("settings")}
  >
    <Icon icon="lucide:settings" class="size-4 opacity-70" />
  </button>

  {#if !mac}
    <div class="flex flex-col items-end px-2 leading-tight">
      <span class="text-xs font-medium tabular-nums">{clock}</span>

      <span class="text-xs text-base-content/60">{day}</span>
    </div>
  {/if}
</nav>
