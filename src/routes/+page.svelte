<script lang="ts">
  import Icon from "@iconify/svelte"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { type AppEntry, appIcon, launchApp, listApps } from "$lib/apps"

  const LIMIT = 6

  const appWindow = getCurrentWindow()

  let apps = $state<AppEntry[]>([])
  let query = $state("")
  let cursor = $state(0)
  let input = $state<HTMLInputElement>()

  listApps().then(list => (apps = list))

  const score = (name: string, term: string) => {
    const at = name.toLowerCase().indexOf(term)

    return at < 0 ? -1 : (at === 0 ? 0 : 1) * 1000 + at + name.length / 100
  }

  const results = $derived.by(() => {
    const term = query.trim().toLowerCase()

    if (!term) return apps.slice(0, LIMIT)

    return apps
      .map(a => ({ app: a, rank: score(a.name, term) }))
      .filter(r => r.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, LIMIT)
      .map(r => r.app)
  })

  $effect(() => {
    query
    cursor = 0
  })

  const launch = async (app?: AppEntry) => {
    if (!app) return

    await launchApp(app.path)
    query = ""
    await appWindow.hide()
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      cursor = (cursor + 1) % Math.max(results.length, 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      cursor = (cursor - 1 + results.length) % Math.max(results.length, 1)
    } else if (e.key === "Enter") {
      launch(results[cursor])
    } else if (e.key === "Escape") {
      query = ""
      appWindow.hide()
    }
  }

  $effect(() => {
    input?.focus()
  })
</script>

<svelte:window onfocus={() => input?.focus()} />

<main class="flex h-full flex-col gap-2 p-5">
  <label class="input input-lg w-full rounded-full border-0 bg-base-100/20 backdrop-blur-md">
    <Icon icon="lucide:search" class="size-5 opacity-60" />

    <input
      bind:this={input}
      bind:value={query}
      {onkeydown}
      type="text"
      placeholder="Search apps"
      spellcheck="false"
      autocomplete="off"
    />
  </label>

  <ul class="menu w-full grow gap-1 overflow-y-auto p-0 [&_li>*]:rounded-full">
    {#each results as app, i (app.path)}
      <li>
        <button
          class="flex items-center gap-3 py-2"
          class:menu-active={i === cursor}
          onclick={() => launch(app)}
          onmouseenter={() => (cursor = i)}
        >
          {#await appIcon(app.path) then icon}
            {#if icon}
              <img src={icon} alt="" class="size-5 shrink-0" />
            {:else}
              <Icon icon="lucide:app-window" class="size-5 shrink-0 opacity-70" />
            {/if}
          {/await}

          <span class="truncate">{app.name}</span>
        </button>
      </li>
    {:else}
      <li class="px-4 py-2 text-sm text-base-content/50">
        {query ? "No matches" : "Loading apps…"}
      </li>
    {/each}
  </ul>
</main>
