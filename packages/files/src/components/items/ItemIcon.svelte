<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { ClassValue } from "svelte/elements"
  import {
    forgetSample,
    type Item,
    iconPixels,
    iconSource,
    isShortcut,
  } from "../../items"
  import { shellImage } from "../../native"
  import { isMarked } from "../../store/privacy.svelte"

  let {
    source,
    rem,
    thumbnail = false,
    class: className = "",
  }: {
    source: Item | string
    rem: number
    thumbnail?: boolean
    class?: ClassValue
  } = $props()

  let broken = $state("")

  const pixels = $derived(iconPixels(rem))

  const item = $derived(typeof source === "string" ? null : source)

  const shortcut = $derived(item !== null && isShortcut(item))

  const marked = $derived(item !== null && isMarked(item.path))

  const url = $derived(
    typeof source === "string"
      ? shellImage("item", pixels, source)
      : iconSource(source, pixels, thumbnail && !marked),
  )
</script>

<span class={["relative inline-flex", className]}>
  {#if !url || broken === url}
    <Icon
      icon={item && !item.dir ? "lucide:file" : "lucide:folder"}
      class="size-full text-base-content/60"
    />
  {:else}
    <img
      src={url}
      alt=""
      draggable="false"
      decoding="async"
      class="size-full object-contain"
      onerror={() => {
        broken = url

        if (item) {
          forgetSample(item)
        }
      }}
    />
  {/if}

  {#if shortcut}
    <span
      class="absolute bottom-0 left-0 flex size-1/2 max-h-6 max-w-6 items-center justify-center rounded-sm border border-base-content/20 bg-base-100 text-base-content"
    >
      <Icon icon="lucide:arrow-up-right" class="size-full" />
    </span>
  {/if}

  {#if marked}
    <span
      class="absolute right-0 bottom-0 flex size-1/2 max-h-6 max-w-6 items-center justify-center rounded-sm border border-base-content/20 bg-base-100 text-base-content"
    >
      <Icon icon="lucide:eye-off" class="size-full" />
    </span>
  {/if}
</span>
