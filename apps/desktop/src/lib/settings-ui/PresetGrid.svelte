<script lang="ts">
  import Icon from "@iconify/svelte"
  import { live, presets as userPresets } from "$lib/data"
  import type { Profile } from "@eris/settings"
  import { type PresetDefinition, presets as builtIn } from "$lib/theme"
  import { allPresets, CUSTOM, matchPreset, swatchFor } from "./presets"
  import { t } from "svelte-i18n"

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

  const forked = $derived(
    builtIn.find(p => p.id === profile.presetId)?.name ??
      user.items.find(p => p.id === profile.presetId)?.name ??
      null,
  )

  const custom: PresetDefinition = {
    id: CUSTOM,
    name: "",
    description: "",
    appearance: profile.appearance,
    swatch: swatchFor(profile.appearance),
  }
</script>

{#snippet card(p: PresetDefinition, active: boolean, customName?: string)}
  <div class="group relative w-44 shrink-0 snap-start">
    <button
      type="button"
      aria-pressed={active}
      class={[
        "flex h-28 w-full flex-col gap-2 rounded-box border p-3 text-left outline-none transition duration-100 focus-visible:ring-2 focus-visible:ring-primary/50",
        active
          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
          : "border-base-content/10 bg-base-100/40 hover:bg-base-content/5",
      ]}
      onclick={() => choose(p)}
    >
      <div
        class="flex h-10 w-full shrink-0 overflow-hidden rounded-field ring-1 ring-base-content/10"
      >
        {#each p.swatch as color, at (at)}
          <div class="grow" style:background={color}></div>
        {/each}
      </div>

      <div class="flex items-center justify-between gap-2">
        <span class="truncate text-sm font-medium">
          {customName ?? p.name}
        </span>

        {#if active}
          <Icon icon="lucide:check" class="size-4 shrink-0 text-primary" />
        {/if}
      </div>

      <span class="h-8 shrink-0 line-clamp-2 text-xs text-base-content/60">
        {customName !== undefined
          ? $t("settings.appearance.forkedFrom", {
              values: { name: forked ?? $t("settings.appearance.preset") },
            })
          : $t(`settings.appearance.presetDescriptions.${builtInIds.has(p.id) ? p.id : "user"}`)}
      </span>
    </button>

    {#if !customName && !builtInIds.has(p.id)}
      <button
        type="button"
        class="btn btn-circle btn-ghost btn-xs absolute top-2 right-2 opacity-0 transition-opacity duration-100 group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={$t("settings.appearance.deletePreset", { values: { name: p.name } })}
        onclick={() => userPresets.remove(p.id)}
      >
        <Icon icon="lucide:trash-2" class="size-3.5" />
      </button>
    {/if}
  </div>
{/snippet}

<div class="flex snap-x gap-3 overflow-x-auto pb-1">
  {#if activeId === CUSTOM}
    {@render card(custom, true, $t("settings.appearance.customPreset"))}
  {/if}

  {#each list as p (p.id)}
    {@render card(p, p.id === activeId)}
  {/each}
</div>
