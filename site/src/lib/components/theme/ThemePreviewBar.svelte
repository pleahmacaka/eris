<script lang="ts">
import Icon from "@iconify/svelte"
import { onMount } from "svelte"
import type { ColorScheme } from "#lib/brand/themeFamilies.js"
import type { Copy } from "#lib/server/copy.js"
import { themePreview } from "#lib/store/themePreview.svelte.js"

let { t }: { t: Copy["themes"] } = $props()

const SCHEME_ICON: Record<ColorScheme, string> = {
  dark: "lucide:moon",
  light: "lucide:sun",
}

const tile = $derived(t.tiles.find(item => item.id === themePreview.family))

onMount(() => themePreview.restore(t.tiles, t.fallback))
</script>

<div
  class={["h-20 shrink-0", !themePreview.active && "hidden"]}
  aria-hidden="true"
></div>

<aside
  aria-label={t.preview.region}
  inert={!themePreview.active}
  class={[
    "pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 flex",
    "justify-center px-3 pt-3 transition-[opacity,translate,visibility]",
    !themePreview.active && "invisible translate-y-4 opacity-0",
  ]}
>
  <div
    class={[
      "pointer-events-auto flex max-w-full items-center gap-2 rounded-box border",
      "border-base-content/20 bg-base-200 p-2 shadow-xl",
    ]}
  >
    <p
      role="status"
      class="flex min-w-0 items-center gap-2 px-2 font-medium text-sm"
    >
      <span class="shrink-0 text-primary max-sm:hidden">
        <Icon icon="lucide:palette" class="size-4" />
      </span>
      <span class="min-w-0 truncate sm:hidden" aria-hidden="true">
        {tile?.name}
      </span>
      <span class="min-w-0 truncate max-sm:sr-only" title={tile?.status}>
        {tile?.status}
      </span>
    </p>

    <div class="join shrink-0" role="group" aria-label={t.preview.mode}>
      {#each t.preview.schemes as scheme (scheme.id)}
        <button
          type="button"
          class="btn btn-sm join-item max-sm:px-2"
          aria-pressed={themePreview.scheme === scheme.id}
          onclick={() => themePreview.setScheme(scheme.id)}
        >
          <Icon icon={SCHEME_ICON[scheme.id]} class="size-4" />
          {scheme.label}
        </button>
      {/each}
    </div>

    <button
      type="button"
      class="btn btn-ghost btn-sm max-sm:btn-square"
      aria-label={t.preview.reset}
      title={t.preview.reset}
      onclick={() => themePreview.reset(t.fallback)}
    >
      <Icon icon="lucide:x" class="size-4" />
      <span class="max-sm:hidden">{t.preview.reset}</span>
    </button>
  </div>
</aside>
