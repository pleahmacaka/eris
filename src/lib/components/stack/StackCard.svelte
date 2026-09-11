<script lang="ts">
import type { Capability } from "$lib/data/stack"

let { capability }: { capability: Capability } = $props()

const MARKER = /\[([a-z0-9]+)\]/g

type Segment = { text: string; href?: string }

function segments(body: string): Segment[] {
  const out: Segment[] = []
  let cursor = 0

  for (const match of body.matchAll(MARKER)) {
    const link = capability.links[match[1]]

    if (!link) {
      continue
    }

    out.push({ text: body.slice(cursor, match.index) })
    out.push({ text: link.label, href: link.href })
    cursor = match.index + match[0].length
  }

  out.push({ text: body.slice(cursor) })

  return out
}
</script>

<article class="card h-full border border-base-300 bg-base-100">
  <div class="card-body gap-3 p-5 sm:p-6">
    <h2 class="font-semibold text-lg tracking-tight">{capability.title()}</h2>

    <p class="text-base-content/75 text-sm leading-relaxed">
      {#each segments(capability.body()) as segment, i (i)}
        {#if segment.href}<a
            class="link decoration-primary/40 underline-offset-2"
            href={segment.href}
            rel="noreferrer"
            target="_blank">{segment.text}</a
          >{:else}{segment.text}{/if}
      {/each}
    </p>

    <ul class="mt-1 flex flex-wrap gap-1.5">
      {#each capability.stack as item (item)}
        <li
          class="rounded-field bg-base-200 px-2 py-0.5 text-base-content/70 text-xs"
        >
          {item}
        </li>
      {/each}
    </ul>
  </div>
</article>
