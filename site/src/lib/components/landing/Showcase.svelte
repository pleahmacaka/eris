<script lang="ts">
import Icon from "@iconify/svelte"
import { SCREEN_ICONS } from "#lib/landing/icons.js"
import { SCREEN_IMAGES } from "#lib/landing/screens.js"
import type { Copy } from "#lib/server/copy.js"
import Section from "./Section.svelte"

let { t }: { t: Copy["showcase"] } = $props()

let active = $state(0)
</script>

<Section id="preview" eyebrow={t.eyebrow} title={t.title} body={t.body}>
  <div class="flex flex-col gap-3 lg:flex-row">
    <fieldset
      class="flex flex-wrap gap-1 lg:w-48 lg:shrink-0 lg:flex-col lg:flex-nowrap"
    >
      <legend class="sr-only">{t.tabs}</legend>

      {#each t.screens as screen, index (screen.id)}
        <button
          type="button"
          aria-pressed={active === index}
          class={[
            "btn btn-sm btn-ghost lg:justify-start",
            active === index && "btn-active",
          ]}
          onclick={() => (active = index)}
        >
          <Icon icon={SCREEN_ICONS[screen.id]} class="size-4 shrink-0" />
          <span class="min-w-0 truncate">{screen.name}</span>
        </button>
      {/each}
    </fieldset>

    <figure class="flex min-w-0 flex-1 flex-col gap-3">
      <div class="rounded-box border border-base-content/10 bg-base-200">
        <div class="backglow grid rounded-box p-2 sm:p-4">
          {#each t.screens as screen, index (screen.id)}
            <div
              aria-hidden={active !== index}
              class={[
                "col-start-1 row-start-1 transition-opacity",
                active !== index && "opacity-0",
              ]}
            >
              <enhanced:img
                src={SCREEN_IMAGES[screen.id]}
                alt={screen.alt}
                sizes="(min-width: 64rem) 52rem, 100vw"
                loading="lazy"
                decoding="async"
                class="block h-auto w-full rounded-field border border-base-content/10"
              />
            </div>
          {/each}
        </div>
      </div>

      <figcaption class="grid text-base-content/70 text-sm">
        {#each t.screens as screen, index (screen.id)}
          <span
            aria-hidden={active !== index}
            class={["col-start-1 row-start-1", active !== index && "invisible"]}
          >
            {screen.body}
          </span>
        {/each}
      </figcaption>
    </figure>
  </div>
</Section>
