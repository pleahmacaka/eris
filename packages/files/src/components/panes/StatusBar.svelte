<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { t } from "svelte-i18n"
  import { formatBytes } from "../../format"
  import { cancelSearch, measureDirs, randomToken } from "../../native"
  import type { Explorer } from "../../store/explorer.svelte"
  import { VIEW_ICONS, type ViewMode } from "../../store/prefs.svelte"

  let { explorer }: { explorer: Explorer } = $props()

  const QUICK: ViewMode[] = ["details", "large"]

  const MEASURE_DELAY = 200

  const tab = $derived(explorer.tab)

  const bytes = $derived(
    explorer.selected
      .filter(item => !item.dir)
      .reduce((sum, item) => sum + item.size, 0),
  )

  const folders = $derived(
    explorer.filesystem
      ? explorer.selected
          .filter(item => item.dir)
          .map(item => item.path)
          .join("\n")
      : "",
  )

  let measured = $state<number | null>(0)

  $effect(() => {
    if (!folders) {
      measured = 0

      return
    }

    const paths = folders.split("\n")
    const token = randomToken()
    let current = true

    measured = null

    const timer = setTimeout(() => {
      measureDirs(paths, token)
        .then(size => {
          if (current) {
            measured = size ?? 0
          }
        })
        .catch(() => {
          if (current) {
            measured = 0
          }
        })
    }, MEASURE_DELAY)

    return () => {
      current = false
      clearTimeout(timer)
      cancelSearch(token).catch(() => undefined)
    }
  })

  const total = $derived(measured === null ? null : bytes + measured)
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

    {#if total === null}
      <span class="flex items-center gap-1.5">
        <span class="loading loading-spinner loading-xs"></span>
        {$t("explorer.status.measuring")}
      </span>
    {:else if total > 0}
      <span>{formatBytes(total, currentLocale())}</span>
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
