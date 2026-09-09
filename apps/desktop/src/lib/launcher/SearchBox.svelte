<script lang="ts">
  import Icon from "@iconify/svelte"
  import { saveDevice, type WebSearchEngine } from "@eris/settings"
  import { Segmented } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { EditSpot } from "$lib/edit"
  import type { Launcher } from "./launcher.svelte"
  import { timerKindLabel } from "./providers"

  let { launcher }: { launcher: Launcher } = $props()

  type LauncherBool = "showWindows" | "showCommands" | "showTodos" | "calculator"

  const ENGINE_NAMES: Record<WebSearchEngine, string> = {
    google: "Google",
    duckduckgo: "DuckDuckGo",
    bing: "Bing",
    naver: "Naver",
  }

  const engineOptions = Object.entries(ENGINE_NAMES).map(([value, label]) => ({
    value: value as WebSearchEngine,
    label,
  }))

  const route = $derived(launcher.route)

  const modeLabel = $derived(
    route.mode === "timer"
      ? timerKindLabel(route.kind)
      : route.mode === "search"
        ? ""
        : $t(`launcher.modes.${route.mode}`),
  )
</script>

{#snippet launcherToggle(key: LauncherBool, label: string)}
  <label class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{label}</span>

    <input
      type="checkbox"
      class="toggle toggle-primary toggle-xs"
      checked={launcher.profile.launcher[key]}
      onchange={e => launcher.patchLauncher(key, e.currentTarget.checked)}
    />
  </label>
{/snippet}

{#snippet searchOptions()}
  <label class="flex flex-col gap-1 py-1 text-xs">
    <span class="flex justify-between">
      <span>{$t("settings.rows.resultsPerGroup")}</span>

      <span class="text-base-content/60 tabular-nums">{launcher.profile.launcher.maxResults}</span>
    </span>

    <input
      type="range"
      class="range range-primary range-xs"
      min="3"
      max="12"
      step="1"
      value={launcher.profile.launcher.maxResults}
      onchange={e => launcher.patchLauncher("maxResults", Number(e.currentTarget.value))}
    />
  </label>

  {@render launcherToggle("showWindows", $t("settings.rows.openWindows"))}
  {@render launcherToggle("showCommands", $t("settings.rows.commands"))}
  {@render launcherToggle("showTodos", $t("settings.rows.todos"))}
  {@render launcherToggle("calculator", $t("settings.rows.calculator"))}

  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.webSearch")}</span>

    <Segmented value={launcher.profile.launcher.webSearch} options={engineOptions} onchange={v => launcher.patchLauncher("webSearch", v)} />
  </div>

  <label class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.showKeymap")}</span>

    <input
      type="checkbox"
      class="toggle toggle-primary toggle-xs"
      checked={launcher.device.showKeymap}
      onchange={e => saveDevice({ ...$state.snapshot(launcher.device), showKeymap: e.currentTarget.checked })}
    />
  </label>
{/snippet}

<EditSpot id="search" label={$t("edit.spots.search")} placement="down" align="start" options={searchOptions}>
<label
  data-launcher
  class="input input-lg flex h-14 w-full shrink-0 items-center gap-3 rounded-box border border-base-content/10 bg-base-100/60 px-4 shadow-lg outline-none backdrop-blur-xl transition-[border-color,box-shadow] duration-150 focus-within:border-primary/40 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/20"
>
  <Icon icon="lucide:search" class="size-5 shrink-0 text-base-content/60" />

  <input
    bind:this={launcher.input}
    bind:value={launcher.query}
    oninput={() => launcher.reset()}
    type="text"
    placeholder={$t("launcher.placeholder")}
    spellcheck="false"
    autocomplete="off"
    autocapitalize="off"
    class="min-w-0 grow select-text bg-transparent text-lg outline-none placeholder:text-base-content/40"
  />

  {#if modeLabel}
    <span class="badge badge-soft badge-primary badge-sm shrink-0">{modeLabel}</span>
  {/if}

  {#if launcher.query}
    <button
      type="button"
      class="btn btn-circle btn-ghost btn-xs shrink-0"
      aria-label={$t("launcher.clear")}
      tabindex="-1"
      onclick={() => launcher.setQuery("")}
    >
      <Icon icon="lucide:x" class="size-4" />
    </button>
  {/if}
</label>
</EditSpot>
