<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Snippet } from "svelte"
  import { t } from "svelte-i18n"

  export type RowTag = "experimental" | "partial"

  let {
    label,
    hint,
    value,
    tag,
    stacked = false,
    onreset,
    children,
  }: {
    label: string
    hint?: string
    value?: string
    tag?: RowTag
    stacked?: boolean
    onreset?: () => void
    children: Snippet
  } = $props()
</script>

<div
  data-row={label}
  class={[
    "group/row flex gap-4 px-4 py-3",
    stacked ? "flex-col" : "items-center justify-between",
  ]}
>
  <div class="flex min-w-0 grow items-center justify-between gap-3">
    <div class="flex min-w-0 items-center gap-1.5">
      <div class="flex min-w-0 flex-col">
        <span class="flex items-center gap-2 text-sm font-medium">
          {label}

          {#if tag}
            <span
              class={[
                "badge badge-soft badge-xs",
                tag === "experimental" ? "badge-warning" : "badge-info",
              ]}
            >
              {$t(`common.${tag}`)}
            </span>
          {/if}
        </span>

        {#if hint}
          <span class="text-xs text-base-content/60">{hint}</span>
        {/if}
      </div>

      {#if onreset}
        <button
          type="button"
          class="btn btn-ghost btn-circle btn-xs shrink-0 opacity-0 transition-opacity duration-100 group-hover/row:opacity-60 hover:opacity-100 focus-visible:opacity-100"
          aria-label={$t("common.reset")}
          title={$t("common.reset")}
          onclick={onreset}
        >
          <Icon icon="lucide:rotate-ccw" class="size-3.5" />
        </button>
      {/if}
    </div>

    {#if value !== undefined}
      <span class="text-xs text-base-content/70 tabular-nums">{value}</span>
    {/if}
  </div>

  <div class={["shrink-0", stacked && "w-full"]}>
    {@render children()}
  </div>
</div>
