<script lang="ts">
import Icon from "@iconify/svelte"
import type { Snippet } from "svelte"
import { useMockDemo } from "#lib/store/mockDemo.svelte.js"
import MockAvatar from "./MockAvatar.svelte"

type Props = {
  title: string
  back: string
  icon?: string
  avatar?: string
  children?: Snippet
}

let { title, back, icon, avatar, children }: Props = $props()

const demo = useMockDemo()
</script>

<div
  class={[
    "flex h-10 shrink-0 items-center gap-2 border-b px-3",
    "border-base-content/10",
  ]}
>
  {#if demo}
    <button
      type="button"
      class="btn btn-ghost btn-square btn-xs @2xl:hidden"
      aria-label={back}
      title={back}
      onclick={() => demo.toggleList()}
    >
      <Icon icon="lucide:arrow-left" class="size-4 rtl:-scale-x-100" />
    </button>
  {:else}
    <span class="shrink-0 text-base-content/70 @2xl:hidden">
      <Icon icon="lucide:arrow-left" class="size-4 rtl:-scale-x-100" />
    </span>
  {/if}

  {#if avatar}
    <MockAvatar name={avatar} size="xs" tone="primary" />
  {:else if icon}
    <Icon {icon} class="size-4 shrink-0 text-base-content/60" />
  {/if}

  <span class="min-w-0 truncate font-semibold">{title}</span>

  {@render children?.()}
</div>
