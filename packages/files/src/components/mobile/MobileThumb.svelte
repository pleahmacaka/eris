<script lang="ts">
  import Icon from "@iconify/svelte"
  import { thumbnailUrl } from "./mobile"

  let { path, modified, icon }: { path: string; modified: number; icon: string } = $props()

  let url = $state<string | null>(null)

  const watch = (node: HTMLElement) => {
    const observer = new IntersectionObserver(
      seen => {
        if (seen.some(entry => entry.isIntersecting)) {
          observer.disconnect()
          thumbnailUrl(path, modified)
            .then(found => {
              url = found
            })
            .catch(() => undefined)
        }
      },
      { rootMargin: "400px" },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }
</script>

<span
  class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-field"
  {@attach watch}
>
  {#if url}
    <img src={url} alt="" decoding="async" class="size-full object-cover" />
  {:else}
    <Icon {icon} class="size-8" />
  {/if}
</span>
