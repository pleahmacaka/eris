<script lang="ts">
  import { currentLocale } from "@eris/i18n"
  import { t } from "svelte-i18n"
  import type { Tensors } from "../../native"

  const { tensors }: { tensors: Tensors } = $props()

  const compact = (value: number) =>
    new Intl.NumberFormat(currentLocale(), {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value)

  const counts = $derived(
    tensors.rows === null
      ? [
          $t("explorer.peek.tensors", { values: { count: tensors.total } }),
          $t("explorer.peek.parameters", {
            values: { count: compact(tensors.parameters) },
          }),
        ]
      : [
          $t("explorer.peek.rows", { values: { count: compact(tensors.rows) } }),
          $t("explorer.peek.columns", { values: { count: tensors.total } }),
        ],
  )

  const hidden = $derived(tensors.total - tensors.tensors.length)
</script>

<div class="flex size-full min-h-0 flex-col gap-2 p-2 text-xs">
  <div
    class={[
      "flex shrink-0 flex-wrap items-baseline gap-x-2 px-1",
      "text-base-content/55 tabular-nums",
    ]}
  >
    <span class="font-medium text-base-content">{tensors.format}</span>
    {#each counts as count (count)}
      <span>{count}</span>
    {/each}
  </div>

  {#if tensors.metadata.length}
    <dl
      class={[
        "grid max-h-32 shrink-0 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5",
        "overflow-y-auto px-1",
      ]}
    >
      {#each tensors.metadata as [key, value], index (index)}
        <dt class="text-base-content/50">{key}</dt>
        <dd class="truncate" title={value}>{value}</dd>
      {/each}
    </dl>
  {/if}

  <ul class="min-h-0 grow overflow-y-auto">
    {#each tensors.tensors as tensor, index (index)}
      <li class="flex flex-col rounded-field px-1 py-1 hover:bg-base-content/5">
        <span class="truncate" title={tensor.name}>{tensor.name}</span>
        <span class="text-base-content/50 tabular-nums">
          {tensor.dtype} [{tensor.shape.join(", ")}]
        </span>
      </li>
    {/each}
  </ul>

  {#if hidden > 0}
    <span class="shrink-0 px-1 text-2xs text-base-content/50">
      {$t("explorer.peek.more", { values: { count: hidden } })}
    </span>
  {/if}
</div>
