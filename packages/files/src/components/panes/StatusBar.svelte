<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { t } from "svelte-i18n"
  import { formatBytes } from "../../format"
  import type { Explorer } from "../../store/explorer.svelte"
  import { VIEW_ICONS, type ViewMode } from "../../store/prefs.svelte"

  let { explorer }: { explorer: Explorer } = $props()

  const QUICK: ViewMode[] = ["details", "large"]

  const tab = $derived(explorer.tab)

  const bytes = $derived(
    explorer.selected
      .filter(item => !item.dir)
      .reduce((sum, item) => sum + item.size, 0),
  )
</script>

<footer
  class={[
    "flex h-7 shrink-0 items-center gap-4 border-t border-base-content/10 px-3",
    "text-xs text-base-content/60 tabular-nums",
  ]}
>
  <span>
    {tab.results
      ? $t("explorer.status.results", {
          values: { count: explorer.visible.length },
        })
      : $t("explorer.status.items", {
          values: { count: explorer.visible.length },
        })}
  </span>

  {#if explorer.selected.length}
    <span>
      {$t("explorer.status.selected", {
        values: { count: explorer.selected.length },
      })}
    </span>

    {#if bytes > 0}
      <span>{formatBytes(bytes, currentLocale())}</span>
    {/if}
  {/if}

  {#if tab.searching}
    <span class="flex items-center gap-1.5">
      <span class="loading loading-spinner loading-xs"></span>
      {$t("explorer.status.searching")}
    </span>
  {/if}

  <div class="grow"></div>

  <div class="join">
    {#each QUICK as view (view)}
      <button
        type="button"
        class={[
          "btn join-item btn-ghost btn-xs btn-square",
          explorer.view === view && "btn-active",
        ]}
        aria-label={$t(`explorer.views.${view}`)}
        title={$t(`explorer.views.${view}`)}
        disabled={!explorer.arrangeable}
        onclick={() => explorer.setView(view)}
      >
        <Icon icon={VIEW_ICONS[view]} class="size-3.5" />
      </button>
    {/each}
  </div>
</footer>
