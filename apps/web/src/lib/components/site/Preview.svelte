<script lang="ts">
  import Stage from "@eris/community/Stage.svelte"
  import { DOCK_STYLES, type DockStyle } from "@eris/settings"
  import type { Copy } from "$lib/copy/en"
  import { STUDIO } from "$lib/links"

  let { t }: { t: Copy } = $props()

  const SURFACES = ["desktop", "files", "terminal"] as const

  let surface = $state<(typeof SURFACES)[number]>("desktop")
  let dock = $state<DockStyle>("windows")
</script>

<section
  id="preview"
  aria-label={t.preview.title}
  class="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-24"
>
  <fieldset class="join self-end">
    <legend class="sr-only">{t.preview.dock}</legend>

    {#each DOCK_STYLES as style (style)}
      <button
        type="button"
        aria-pressed={dock === style}
        disabled={surface !== "desktop"}
        class={["btn btn-sm join-item", dock === style && "btn-active"]}
        onclick={() => (dock = style)}
      >
        {t.preview.docks[style]}
      </button>
    {/each}
  </fieldset>

  <div class="flex flex-col gap-3 sm:flex-row">
    <fieldset class="flex gap-1 sm:flex-col">
      <legend class="sr-only">{t.preview.surface}</legend>

      {#each SURFACES as item (item)}
        <button
          type="button"
          aria-pressed={surface === item}
          class={[
            "btn btn-sm btn-ghost sm:justify-start",
            surface === item && "btn-active",
          ]}
          onclick={() => (surface = item)}
        >
          {t.preview.surfaces[item]}
        </button>
      {/each}
    </fieldset>

    <div
      class="min-w-0 flex-1 overflow-hidden rounded-box border border-base-content/10"
    >
      <Stage
        studio={STUDIO}
        appearance={{}}
        device={{ dockStyle: dock }}
        {surface}
        title={t.preview.title}
        unavailable={t.preview.unavailable}
      />
    </div>
  </div>
</section>
