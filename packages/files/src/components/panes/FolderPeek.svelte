<script lang="ts">
  import { t } from "svelte-i18n"
  import type { Item } from "../../items"
  import ItemIcon from "../items/ItemIcon.svelte"

  const { items, label }: { items: Item[]; label: string } = $props()

  const SHOWN = 60

  const sorted = $derived(
    [...items].sort(
      (a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name),
    ),
  )
</script>

<div class="flex size-full min-h-0 flex-col gap-2 p-2">
  <span class="shrink-0 px-1 text-xs text-base-content/55">{label}</span>

  {#if items.length === 0}
    <div class="flex grow items-center justify-center text-sm text-base-content/50">
      {$t("explorer.states.empty")}
    </div>
  {:else}
    <ul class="grid min-h-0 grow auto-rows-min grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1 overflow-y-auto">
      {#each sorted.slice(0, SHOWN) as child (child.key)}
        <li class="flex min-w-0 flex-col items-center gap-1 rounded-field p-1 text-center" title={child.name}>
          <ItemIcon source={child} rem={3} thumbnail class="size-12" />
          <span class="line-clamp-2 w-full text-2xs break-all text-base-content/75">{child.name}</span>
        </li>
      {/each}
    </ul>

    {#if items.length > SHOWN}
      <span class="shrink-0 px-1 text-2xs text-base-content/50">
        {$t("explorer.peek.more", { values: { count: items.length - SHOWN } })}
      </span>
    {/if}
  {/if}
</div>
