<script lang="ts">
import Icon from "@iconify/svelte"
import type { Project } from "$lib/data/projects"

let { project }: { project: Project } = $props()
</script>

<article class="card h-full border border-base-300 bg-base-100">
  <div class="card-body gap-3 p-5 sm:p-6">
    <h3 class="font-semibold text-lg tracking-tight">
      <a
        class="link link-hover inline-flex items-center gap-1.5"
        href={project.href}
        rel="noreferrer"
        target="_blank"
      >
        {project.name}
        <Icon
          class="size-3.5 shrink-0 self-center text-base-content/40"
          icon="lucide:arrow-up-right"
        />
      </a>
    </h3>

    <p class="text-base-content/75 text-sm leading-relaxed">{project.body()}</p>

    <ul class="mt-1 flex flex-wrap gap-1.5">
      {#each project.stack as item (item)}
        <li
          class="rounded-field bg-base-200 px-2 py-0.5 text-base-content/70 text-xs"
        >
          {item}
        </li>
      {/each}
    </ul>
  </div>
</article>
