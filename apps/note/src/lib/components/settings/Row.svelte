<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Snippet } from "svelte"

  const {
    label,
    hint = "",
    icon = "",
    children,
  }: {
    label: string
    hint?: string
    icon?: string
    children?: Snippet
  } = $props()
</script>

<div
  class={[
    "flex flex-col gap-3 px-4 py-3.5",
    "@lg:flex-row @lg:items-center @lg:gap-6",
  ]}
>
  <div class="flex min-w-0 flex-1 items-start gap-3">
    {#if icon}
      <Icon {icon} class="mt-0.5 size-4 shrink-0 text-base-content/45" />
    {/if}

    <div class="min-w-0">
      <p class="text-sm font-medium">{label}</p>
      {#if hint}
        <p class="mt-0.5 text-xs leading-relaxed text-base-content/50">
          {hint}
        </p>
      {/if}
    </div>
  </div>

  {#if children}
    <div
      class={[
        "flex shrink-0 flex-wrap items-center gap-2",
        icon && "@max-lg:pl-7",
      ]}
    >
      {@render children()}
    </div>
  {/if}
</div>
