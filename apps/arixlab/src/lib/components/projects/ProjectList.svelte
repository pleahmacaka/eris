<script lang="ts">
import Icon from "@iconify/svelte/dist/OfflineIcon.svelte"
import { projects } from "$lib/data/projects"
import * as m from "$lib/paraglide/messages"
import { localizeHref } from "$lib/paraglide/runtime"
import { SITE_URL } from "$lib/site"

const pad = (n: number) => String(n).padStart(2, "0")

const host = new URL(SITE_URL).host
</script>

<section class="flex w-full max-w-md flex-col gap-3">
  <div class="flex items-center justify-between text-base-content/60 text-xs">
    <h2>{m.section_projects()}</h2>
    <span class="tabular-nums">{pad(projects.length)}</span>
  </div>

  <ul class="flex flex-col gap-2">
    {#each projects as project, i (project.path)}
      <li>
        <a
          class={[
            "hud group flex items-center gap-4 bg-base-100/50 px-5 py-4",
            "transition hover:hud-lit",
          ]}
          href={localizeHref(project.path)}
        >
          <span class="text-primary text-xs tabular-nums">{pad(i + 1)}</span>
          <span class="flex min-w-0 flex-col">
            <span class="font-semibold">{project.name}</span>
            <span class="truncate text-base-content/60 text-xs">
              {project.about()}
            </span>
          </span>
          <span
            class="ml-auto hidden shrink-0 text-base-content/60 text-sm sm:block"
          >
            {host}{project.path}
          </span>
          <Icon
            class={[
              "size-4 shrink-0 text-base-content/50 transition",
              "group-hover:text-primary",
            ]}
            icon="lucide:arrow-up-right"
          />
        </a>
      </li>
    {/each}
  </ul>
</section>
