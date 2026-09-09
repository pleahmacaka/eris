<script lang="ts">
  import { t } from "svelte-i18n"
  import type { Launcher } from "./launcher.svelte"

  let { launcher }: { launcher: Launcher } = $props()

  const HINTS: [string, string][] = [
    [">", "run"],
    ["t", "todo"],
    ["=", "calc"],
    [":", "emoji"],
    ["v", "clip"],
    ["timer", "timer"],
  ]

  const enterLabel = $derived(
    launcher.route.mode === "clip"
      ? $t("launcher.enter.paste")
      : launcher.route.mode === "emoji"
        ? $t("launcher.enter.copy")
        : $t("launcher.enter.open"),
  )

  const current = $derived(launcher.flat[launcher.active])
</script>

{#if launcher.error || launcher.query || launcher.device.showKeymap}
<footer
  data-launcher
  class="flex h-7 shrink-0 items-center justify-between gap-3 overflow-hidden border-t border-base-content/10 px-3 text-xs text-base-content/50"
>
{#if launcher.error}
  <span class="truncate text-error">{launcher.error}</span>
{:else if launcher.query}
  <span class="tabular-nums">
    {$t("launcher.resultCount", { values: { count: launcher.flat.length } })}
  </span>
{:else if launcher.device.showKeymap}
  <div class="flex items-center gap-x-3 overflow-hidden">
    {#each HINTS as [key, label] (key)}
      <button
        type="button"
        class="flex items-center gap-1 transition-colors duration-150 hover:text-base-content"
        tabindex="-1"
        onclick={() => launcher.insertPrefix(key === ":" ? key : `${key} `)}
      >
        <kbd class="kbd kbd-xs">{key}</kbd>
        {$t(`launcher.hints.${label}`)}
      </button>
    {/each}
  </div>
{/if}

{#if launcher.query && launcher.device.showKeymap}
  <div class="flex shrink-0 items-center gap-3">
    <span class="flex items-center gap-1">
      <kbd class="kbd kbd-xs">↵</kbd>
      {enterLabel}
    </span>

    {#if launcher.secondary(current, "admin")}
      <span class="flex items-center gap-1">
        <kbd class="kbd kbd-xs">⇧↵</kbd> {$t("launcher.footer.admin")}
      </span>
    {/if}

    {#if launcher.secondary(current, "location")}
      <span class="flex items-center gap-1">
        <kbd class="kbd kbd-xs">⌃↵</kbd> {$t("launcher.footer.location")}
      </span>
    {/if}
  </div>
{:else if launcher.groups.length > 1 && launcher.device.showKeymap}
  <span class="flex shrink-0 items-center gap-1">
    <kbd class="kbd kbd-xs">Tab</kbd> {$t("launcher.footer.groups")}
  </span>
{/if}
</footer>
{/if}
