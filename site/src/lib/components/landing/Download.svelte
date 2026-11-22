<script lang="ts">
import Icon from "@iconify/svelte"
import { RELEASES, REPO } from "#lib/landing/content.js"
import { PLATFORM_ICONS } from "#lib/landing/icons.js"
import type { Copy } from "#lib/server/copy.js"
import Section from "./Section.svelte"

let { t }: { t: Copy } = $props()

const CARD = [
  "flex flex-col gap-4 rounded-box border p-6",
  "border-base-content/10 bg-base-100/50",
]
</script>

<Section id="download" title={t.download.title} body={t.download.body}>
  <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {#each t.installers as platform (platform.id)}
      <li class={CARD}>
        <div class="flex items-center gap-3">
          <Icon icon={PLATFORM_ICONS[platform.id]} class="size-7 shrink-0" />
          <h3 class="font-bold text-xl">{platform.name}</h3>
        </div>

        <ul class="flex flex-wrap gap-1.5">
          {#each platform.formats as format (format)}
            <li class="badge badge-neutral" dir="ltr">{format}</li>
          {/each}
        </ul>

        <a
          class="btn btn-primary mt-auto"
          href={RELEASES}
          aria-label={platform.action}
        >
          <Icon icon="lucide:download" class="size-4" />
          {t.hero.download}
        </a>
      </li>
    {/each}

    <li class={CARD}>
      <div class="flex items-center gap-3">
        <Icon icon={PLATFORM_ICONS.web} class="size-7 shrink-0" />
        <h3 class="font-bold text-xl">{t.web.name}</h3>
      </div>

      <p class="text-base-content/70 text-sm">{t.web.body}</p>

      <a class="btn mt-auto" href={REPO}>
        {t.web.action}
        <Icon icon="lucide:arrow-up-right" class="size-4 rtl:-scale-x-100" />
      </a>
    </li>
  </ul>
</Section>
