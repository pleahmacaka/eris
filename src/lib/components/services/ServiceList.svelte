<script lang="ts">
import Icon from "@iconify/svelte/dist/OfflineIcon.svelte"
import { services, serviceUrl } from "$lib/data/services"
import * as m from "$lib/paraglide/messages"

const pad = (n: number) => String(n).padStart(2, "0")
</script>

<section class="flex w-full max-w-md flex-col gap-3">
  <div class="flex items-center justify-between text-base-content/60 text-xs">
    <h2>{m.section_services()}</h2>
    <span class="tabular-nums">{pad(services.length)}</span>
  </div>

  <ul class="flex flex-col gap-2">
    {#each services as service, i (service.host)}
      <li>
        <a
          class={[
            "hud group flex items-center gap-4 bg-base-100/50 px-5 py-4",
            "transition hover:hud-lit",
          ]}
          href={serviceUrl(service)}
        >
          <span class="text-primary text-xs tabular-nums">{pad(i + 1)}</span>
          <span class="font-semibold">{service.name}</span>
          <span class="ml-auto truncate text-base-content/60 text-sm">
            {service.host}
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
