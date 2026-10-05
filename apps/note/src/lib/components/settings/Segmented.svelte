<script lang="ts" generics="T extends string | number | boolean">
  import Icon from "@iconify/svelte"

  type Option = { id: T; label: string; icon?: string }

  const {
    options,
    value,
    label,
    onchange,
  }: {
    options: Option[]
    value: T
    label: string
    onchange: (value: T) => void
  } = $props()
</script>

<div
  class="flex flex-wrap border border-base-content/15 p-0.5"
  role="radiogroup"
  aria-label={label}
>
  {#each options as option (option.id)}
    <button
      class={[
        "flex cursor-pointer items-center gap-1.5 px-3 py-1 text-xs transition",
        option.id === value
          ? "bg-primary text-primary-content"
          : "text-base-content/60 hover:bg-base-content/5 hover:text-base-content",
      ]}
      role="radio"
      aria-checked={option.id === value}
      onclick={() => onchange(option.id)}
    >
      {#if option.icon}
        <Icon icon={option.icon} class="size-3.5" />
      {/if}
      {option.label}
    </button>
  {/each}
</div>
