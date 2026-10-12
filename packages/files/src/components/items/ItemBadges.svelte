<script lang="ts">
  import { t } from "svelte-i18n"
  import type { Item } from "../../items"
  import { hoursLeft } from "../../store/cleanup.svelte"
  import type { InsightView } from "../../store/insight.svelte"
  import { prefs } from "../../store/prefs.svelte"
  import CleanupBadge from "./CleanupBadge.svelte"
  import RepoChip from "./RepoChip.svelte"

  let { item, view }: { item: Item; view: InsightView } = $props()

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
  <RepoChip kind={repo} />
{/if}

{#if prefs.cleanup && view.installers.has(item.key)}
  <CleanupBadge
    hours={hoursLeft(item)}
    title={$t("explorer.decor.cleanupHint", { values: { hours: prefs.cleanupHours } })}
  />
{/if}
