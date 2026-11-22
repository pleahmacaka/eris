<script lang="ts">
import Icon from "@iconify/svelte"
import type { Snippet } from "svelte"
import type { ClassValue } from "svelte/elements"
import { useMockDemo } from "#lib/store/mockDemo.svelte.js"

type Props = {
  title: string
  close: string
  class?: ClassValue
  aside?: Snippet
  children: Snippet
}

let { title, close, class: className, aside, children }: Props = $props()

const demo = useMockDemo()
</script>

<div
  class="absolute inset-0 flex items-center justify-center bg-base-300/80 p-3"
>
  <div
    class={[
      "flex max-h-full w-full flex-col gap-3 overflow-hidden rounded-box border",
      "border-base-content/20 bg-base-100 p-4 shadow-2xl",
      className,
    ]}
  >
    <div class="flex shrink-0 items-center justify-between gap-3">
      <span class="min-w-0 truncate font-bold text-base">{title}</span>

      <span class="flex shrink-0 items-center gap-2">
        {@render aside?.()}

        {#if demo}
          <button
            type="button"
            class="btn btn-ghost btn-square btn-xs"
            aria-label={close}
            title={close}
            onclick={() => demo.show("chat")}
          >
            <Icon icon="lucide:x" class="size-4" />
          </button>
        {/if}
      </span>
    </div>

    {@render children()}
  </div>
</div>
