<script lang="ts">
import type { Capability } from "$lib/data/stack"

let { capability }: { capability: Capability } = $props()
</script>

<article class="card h-full border border-base-300 bg-base-100">
  <div class="card-body gap-3 p-5 sm:p-6">
    <h2 class="text-lg font-semibold tracking-tight">{capability.title}</h2>

    <p class="text-base-content/75 text-sm leading-relaxed">
      {#each capability.body as part}
        {#if typeof part === "string"}{part}{:else}<a
            class="link decoration-primary/40 underline-offset-2"
            href={part.href}
            rel="noreferrer"
            target="_blank">{part.text}</a
          >{/if}
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
