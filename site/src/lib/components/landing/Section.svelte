<script lang="ts">
import type { Snippet } from "svelte"
import { reveal } from "#lib/attachments/reveal.js"
import Eyebrow from "#lib/components/ui/Eyebrow.svelte"

type Props = {
  id: string
  eyebrow: string
  title: string
  body?: string
  split?: boolean
  children: Snippet
}

let { id, eyebrow, title, body, split = false, children }: Props = $props()
</script>

<section
  {id}
  aria-labelledby="{id}-title"
  class={[
    "mx-auto grid max-w-6xl gap-10 px-6 py-20 sm:py-28",
    split && "lg:grid-cols-5 lg:items-center",
  ]}
>
  <header
    {@attach reveal}
    class={["flex max-w-2xl flex-col gap-4", split && "lg:col-span-2"]}
  >
    <Eyebrow>{eyebrow}</Eyebrow>

    <h2
      id="{id}-title"
      class={[
        "wrap-break-word text-balance font-black tracking-tighter",
        "text-4xl sm:text-5xl",
      ]}
    >
      {title}
    </h2>

    {#if body}
      <p class="text-base-content/70 text-lg">{body}</p>
    {/if}
  </header>

  <div {@attach reveal} class={["min-w-0", split && "lg:col-span-3"]}>
    {@render children()}
  </div>
</section>
