<script lang="ts">
  import Icon from "@iconify/svelte"
  import { customIcon } from "../../fileicons"
  import type { ClassValue } from "svelte/elements"
  import {
    forgetSample,
    hasThumbnail,
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

  const marked = $derived(item !== null && isMarked(item.path))

  const glyph = $derived(
    item && !(thumbnail && hasThumbnail(item)) ? customIcon(item) : null,
  )

  const linked = $derived(item?.link ?? false)

  const overlay = $derived.by(() => {
    if (!item) {
      return null
    }

    if (item.link) {
      return "lucide:link-2"
    }

    return isShortcut(item) ? "lucide:arrow-up-right" : null
  })

  const url = $derived(
    typeof source === "string"
      ? shellImage("item", pixels, source)
      : iconSource(source, pixels, thumbnail && !marked),
  )
</script>

<span class={["relative inline-flex items-center justify-center", className]}>
  {#if glyph}
    <Icon icon={glyph} class={rem > 2 ? "size-2/3" : "size-full"} />
  {:else if !url || broken === url}
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

  {#if overlay}
    <span
      class={[
        "absolute bottom-0 left-0 flex size-1/2 max-h-6 max-w-6 items-center justify-center rounded-sm border bg-base-100",
        linked ? "border-info/40 text-info" : "border-base-content/20 text-base-content",
      ]}
    >
      <Icon icon={overlay} class="size-full" />
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
