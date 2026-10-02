<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { ClassValue } from "svelte/elements"
  import { forgetSample, type Item, iconPixels, iconSource } from "../../items"
  import { shellImage } from "../../native"

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

  const url = $derived(
    typeof source === "string"
      ? shellImage("item", pixels, source)
      : iconSource(source, pixels, thumbnail),
  )
</script>

{#if !url || broken === url}
  <Icon
    icon={item && !item.dir ? "lucide:file" : "lucide:folder"}
    class={["text-base-content/60", className]}
  />
{:else}
  <img
    src={url}
    alt=""
    draggable="false"
    decoding="async"
    class={["object-contain", className]}
    onerror={() => {
      broken = url

      if (item) {
        forgetSample(item)
      }
    }}
  />
{/if}
