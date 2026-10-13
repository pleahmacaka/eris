<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { hostOf } from "../../hosts"
  import type { GitHead } from "../../native"

  let {
    kind,
    head = null,
    title,
  }: {
    kind: "repo" | "submodule"
    head?: GitHead | null
    title?: string
  } = $props()

  const host = $derived(hostOf(head))
</script>

<span
  class="flex min-w-0 shrink-0 items-center gap-1 rounded-field bg-base-content/8 px-1.5 text-xs text-base-content/60"
  title={title ?? host.slug ?? undefined}
>
  {#if kind === "submodule"}
    <Icon icon="lucide:folder-git-2" class="size-3 shrink-0" />
    {$t("explorer.decor.submodule")}
  {:else}
    <Icon icon={host.icon} class="size-3 shrink-0" />
    {host.name ?? $t("explorer.decor.repo")}
  {/if}

  {#if head?.branch}
    <Icon icon="lucide:git-branch" class="size-3 shrink-0" />
    <span class="max-w-24 truncate">{head.branch}</span>
  {/if}

  {#if host.fork}
    <span
      class="flex shrink-0 items-center"
      title={$t("explorer.decor.forkOf", { values: { upstream: host.fork } })}
      aria-label={$t("explorer.decor.forkOf", { values: { upstream: host.fork } })}
    >
      <Icon icon="lucide:git-fork" class="size-3" />
    </span>
  {/if}
</span>
