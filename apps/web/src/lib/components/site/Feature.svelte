<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Snippet } from "svelte"
  import { textPainter } from "$lib/ascii/raster"
  import AsciiArt from "$lib/components/ascii/AsciiArt.svelte"

  type Props = {
    id: string
    index: number
    icon: string
    title: string
    lead: string
    points: string[]
    badge?: string
    children: Snippet
  }

  let { id, index, icon, title, lead, points, badge, children }: Props =
    $props()

  const numeral = $derived(textPainter(String(index).padStart(2, "0")))
</script>

<li>
  <article
    aria-labelledby="feature-{id}"
    class="grid grid-cols-1 items-center gap-x-16 gap-y-10 lg:grid-cols-12"
  >
    <div class="flex flex-col gap-5 lg:col-span-5">
      <div
        class={[
          "flex items-end justify-between border-t border-base-content/10",
          "pt-5 text-base-content/60",
        ]}
      >
        <AsciiArt
          paint={numeral}
          cols={30}
          rows={9}
          tint="--color-primary"
          interactive
          class="w-36 cursor-crosshair"
        />
        <Icon {icon} class="size-5" />
      </div>

      <h3
        id="feature-{id}"
        class={[
          "flex items-center gap-3 font-bold tracking-tight",
          "text-3xl sm:text-4xl",
        ]}
      >
        {title}

        {#if badge}
          <span class="badge badge-accent badge-sm">{badge}</span>
        {/if}
      </h3>

      <p class="text-base-content/70 text-lg">{lead}</p>

      <ul class="flex flex-col gap-2 text-base-content/80">
        {#each points as point (point)}
          <li class="flex gap-3">
            <span
              class="mt-2.5 size-1 shrink-0 bg-primary"
              aria-hidden="true"
            ></span>
            {point}
          </li>
        {/each}
      </ul>
    </div>

    <div class="lg:col-span-7">
      {@render children()}
    </div>
  </article>
</li>
