<script lang="ts">
  import { t } from "svelte-i18n"
  import type { Item } from "../../items"
  import { hoursLeft, isKept } from "../../store/cleanup.svelte"
  import type { Explorer } from "../../store/explorer.svelte"
  import type { InsightView } from "../../store/insight.svelte"
  import { openCleanupMenu } from "../../store/menus"
  import { prefs } from "../../store/prefs.svelte"
  import CleanupBadge from "./CleanupBadge.svelte"
  import RepoChip from "./RepoChip.svelte"

  let {
    explorer,
    item,
    view,
  }: { explorer: Explorer; item: Item; view: InsightView } = $props()

  const repo = $derived(
    view.submodules.has(item.key)
      ? "submodule"
      : view.repos.has(item.key)
        ? "repo"
        : null,
  )
</script>

{#if prefs.emptyFolders && view.empty.has(item.key)}
  <span class="shrink-0 text-base-content/40">{$t("explorer.decor.empty")}</span>
{/if}

{#if repo}
  <RepoChip kind={repo} head={view.heads.get(item.key)} />
{/if}

{#if prefs.cleanup && view.installers.has(item.key) && !isKept(item)}
  <button
    type="button"
    class="flex shrink-0 cursor-pointer hover:brightness-125"
    title={$t("explorer.decor.cleanupHint", {
      values: { hours: prefs.cleanupHours },
    })}
    onpointerdown={e => e.stopPropagation()}
    ondblclick={e => e.stopPropagation()}
    onclick={e => {
      e.stopPropagation()
      openCleanupMenu(explorer, e.currentTarget, item)
    }}
  >
    <CleanupBadge hours={hoursLeft(item)} />
  </button>
{/if}
