<script lang="ts">
  import Icon from "@iconify/svelte"
  import { live } from "$lib/data/live.svelte"
  import { presets as userPresets } from "$lib/data/store"
  import type { Profile } from "$lib/settings"
  import { type PresetDefinition, presets as builtIn } from "$lib/theme"
  import { allPresets, matchPreset } from "./presets"

  let { profile = $bindable() }: { profile: Profile } = $props()

  const user = live(userPresets)

  $effect(() => () => user.stop())

  const list = $derived(allPresets(user.items))
  const activeId = $derived(matchPreset(list, profile.appearance))
  const builtInIds = new Set(builtIn.map(p => p.id))

  const choose = (p: PresetDefinition) => {
    profile.appearance = { ...p.appearance }
    profile.presetId = p.id
  }
</script>

<div
  class="grid gap-3"
  style="grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr))"
>
  {#each list as p (p.id)}
    {@const active = p.id === activeId}

    <div class="group relative">
      <button
        type="button"
        aria-pressed={active}
        class={[
          "flex w-full flex-col gap-2 rounded-box border p-3 text-left outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-primary/50",
          active
            ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
            : "border-base-content/10 bg-base-100/40 hover:bg-base-content/5",
        ]}
        onclick={() => choose(p)}
      >
        <div
          class="flex h-10 w-full overflow-hidden rounded-field ring-1 ring-base-content/10"
        >
          {#each p.swatch as color, at (at)}
            <div class="grow" style:background={color}></div>
          {/each}
        </div>

        <div class="flex items-center justify-between gap-2">
          <span class="truncate text-sm font-medium">{p.name}</span>

          {#if active}
            <Icon icon="lucide:check" class="size-4 shrink-0 text-primary" />
          {/if}
        </div>

        <span class="line-clamp-2 text-xs text-base-content/60">
          {p.description}
        </span>
      </button>

      {#if !builtInIds.has(p.id)}
        <button
          type="button"
          class="btn btn-circle btn-ghost btn-xs absolute top-2 right-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Delete preset {p.name}"
          onclick={() => userPresets.remove(p.id)}
        >
          <Icon icon="lucide:trash-2" class="size-3.5" />
        </button>
      {/if}
    </div>
  {/each}
</div>
