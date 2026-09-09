<script lang="ts" generics="T extends string | number">
  import Icon from "@iconify/svelte"

  type Option = { value: T; label: string; icon?: string }

  let {
    value = $bindable(),
    options,
    label,
    onchange,
  }: {
    value: T
    options: Option[]
    label?: string
    onchange?: (value: T) => void
  } = $props()
</script>

<div
  role="radiogroup"
  aria-label={label}
  class="inline-flex gap-0.5 rounded-field border border-base-content/10 bg-base-content/5 p-0.5"
>
  {#each options as o (o.value)}
    {@const active = value === o.value}

    <button
      type="button"
      role="radio"
      aria-checked={active}
      class={[
        "flex items-center gap-1.5 rounded-field px-3 py-1 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/50",
        active
          ? "bg-base-100 text-base-content shadow-sm"
          : "text-base-content/60 hover:text-base-content",
      ]}
      onclick={() => {
        value = o.value
        onchange?.(o.value)
      }}
    >
      {#if o.icon}
        <Icon icon={o.icon} class="size-3.5" />
      {/if}

      {o.label}
    </button>
  {/each}
</div>
