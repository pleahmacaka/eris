<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import type { Explorer } from "../../store/explorer.svelte"
  import { sidebarLabel } from "../../store/sidebar"

  let { explorer }: { explorer: Explorer } = $props()

  const OFFSET = 16
</script>

{#if explorer.dropHint}
  {@const hint = explorer.dropHint}

  <div
    class={[
      "pointer-events-none fixed z-50 flex max-w-72 items-center gap-2 rounded-field",
      "border border-base-content/10 bg-base-100/95 px-2.5 py-1.5 text-sm shadow-lg",
    ]}
    style:left="{hint.x + OFFSET}px"
    style:top="{hint.y + OFFSET}px"
    role="status"
  >
    <span
      class={[
        "badge badge-sm shrink-0 gap-1",
        hint.move ? "badge-primary" : "badge-success",
      ]}
    >
      <Icon icon={hint.move ? "lucide:move-right" : "lucide:copy-plus"} class="size-3" />
      {$t(hint.move ? "explorer.drop.move" : "explorer.drop.copy")}
    </span>

    <Icon icon="lucide:folder" class="size-4 shrink-0 text-primary" />
    <span class="min-w-0 truncate font-medium">{sidebarLabel(hint.into, $t)}</span>

    {#if hint.count > 1}
      <span class="shrink-0 text-2xs text-base-content/55">
        {$t("explorer.drop.items", { values: { count: hint.count } })}
      </span>
    {/if}
  </div>
{/if}
