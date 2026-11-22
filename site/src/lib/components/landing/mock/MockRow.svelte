<script lang="ts">
import Icon from "@iconify/svelte"
import type { Snippet } from "svelte"

type Props = {
  label: string
  icon?: string
  active?: boolean
  onclick?: () => void
  children?: Snippet
}

let { label, icon, active = false, onclick, children }: Props = $props()

const ROW = "flex min-h-8 w-full items-center gap-2 rounded-field px-2"

const HOVER = "hover:bg-base-content/5 hover:text-base-content"

const tone = $derived(
  active ? "bg-base-content/10 text-base-content" : "text-base-content/70",
)
</script>

{#snippet content()}
  {#if icon}
    <Icon {icon} class="size-4 shrink-0" />
  {/if}

  {@render children?.()}

  <span class="min-w-0 truncate">{label}</span>
{/snippet}

{#if onclick}
  <button
    type="button"
    aria-current={active ? "page" : undefined}
    class={[ROW, tone, "cursor-pointer text-start", !active && HOVER]}
    {onclick}
  >
    {@render content()}
  </button>
{:else}
  <div class={[ROW, tone]}>
    {@render content()}
  </div>
{/if}
