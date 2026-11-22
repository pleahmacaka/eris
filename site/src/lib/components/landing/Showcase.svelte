<script lang="ts">
import Icon from "@iconify/svelte"
import Dialog from "#lib/components/ui/Dialog.svelte"
import { DEMO_PATH, type ScreenId } from "#lib/landing/content.js"
import type { Copy } from "#lib/server/copy.js"
import MockStage from "./mock/MockStage.svelte"
import ScreenTabs from "./mock/ScreenTabs.svelte"
import Section from "./Section.svelte"

let { t }: { t: Copy["showcase"] } = $props()

let active = $state<ScreenId>("chat")
let expanded = $state(false)
</script>

<Section id="preview" title={t.title} body={t.body}>
  <div class="flex flex-col gap-3 lg:flex-row">
    <ScreenTabs {t} layout="side" bind:active />

    <figure class="flex min-w-0 flex-1 flex-col gap-3">
      <div class="rounded-box border border-base-content/10 bg-base-200">
        <div class="backglow flex flex-col gap-2 rounded-box p-2 sm:p-4 sm:pt-3">
          <div class="flex items-center justify-end gap-1">
            <a class="btn btn-ghost btn-sm" href={DEMO_PATH}>
              <Icon icon="lucide:app-window" class="size-4" />
              {t.demo}
            </a>

            <button
              type="button"
              class="btn btn-ghost btn-sm btn-square"
              aria-label={t.expand}
              title={t.expand}
              onclick={() => (expanded = true)}
            >
              <Icon icon="lucide:maximize-2" class="size-4" />
            </button>
          </div>

          <MockStage {t} {active} />
        </div>
      </div>

      <figcaption class="grid text-base-content/70 text-sm">
        {#each t.screens as screen (screen.id)}
          <span
            aria-hidden={active !== screen.id}
            class={[
              "col-start-1 row-start-1",
              active !== screen.id && "invisible",
            ]}
          >
            {screen.body}
          </span>
        {/each}
      </figcaption>
    </figure>
  </div>
</Section>

<Dialog
  bind:open={expanded}
  label={t.title}
  close={t.close}
  class="h-11/12 max-h-200 w-11/12 max-w-6xl"
>
  {#snippet header()}
    <ScreenTabs {t} bind:active />
  {/snippet}

  <div class="min-h-0 flex-1">
    <MockStage {t} {active} fill />
  </div>
</Dialog>
