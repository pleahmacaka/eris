<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { DeviceSettings } from "$lib/settings"
  import Row from "./Row.svelte"
  import { t } from "svelte-i18n"

  type Feature = keyof DeviceSettings["features"]

  type Preset = {
    id: string
    icon: string
    features: DeviceSettings["features"]
  }

  let {
    device = $bindable(),
    presets = false,
  }: { device: DeviceSettings; presets?: boolean } = $props()

  const FEATURES: { key: Feature; row: string; icon: string }[] = [
    { key: "dock", row: "featureDock", icon: "lucide:panel-bottom" },
    { key: "launcher", row: "featureLauncher", icon: "lucide:search" },
    { key: "chat", row: "featureChat", icon: "lucide:message-circle" },
  ]

  const PRESETS: Preset[] = [
    { id: "all", icon: "lucide:layout-grid", features: { dock: true, launcher: true, chat: true } },
    { id: "desk", icon: "lucide:panel-bottom", features: { dock: true, launcher: true, chat: false } },
    { id: "search", icon: "lucide:search", features: { dock: false, launcher: true, chat: false } },
    { id: "bubble", icon: "lucide:message-circle", features: { dock: false, launcher: false, chat: true } },
  ]

  const same = (a: DeviceSettings["features"], b: DeviceSettings["features"]) =>
    a.dock === b.dock && a.launcher === b.launcher && a.chat === b.chat
</script>

{#if presets}
  <div class="grid grid-cols-2 gap-3 px-4 pt-3" role="radiogroup" aria-label={$t("settings.featurePresets.aria")}>
    {#each PRESETS as preset (preset.id)}
      {@const active = same(device.features, preset.features)}

      <button
        type="button"
        role="radio"
        aria-checked={active}
        class={[
          "flex items-start gap-3 rounded-box border p-3 text-left outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-primary/50",
          active
            ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
            : "border-base-content/10 bg-base-100/40 hover:bg-base-content/5",
        ]}
        onclick={() => (device.features = { ...preset.features })}
      >
        <Icon icon={preset.icon} class="mt-0.5 size-5 shrink-0 text-primary" />

        <span class="min-w-0">
          <span class="block text-sm font-medium">{$t(`settings.featurePresets.${preset.id}.name`)}</span>

          <span class="block text-xs text-base-content/60">{$t(`settings.featurePresets.${preset.id}.hint`)}</span>
        </span>
      </button>
    {/each}
  </div>
{/if}

{#each FEATURES as feature (feature.key)}
  <Row label={$t(`settings.rows.${feature.row}`)} hint={$t(`settings.hints.${feature.row}`)}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t(`settings.rows.${feature.row}`)}
      bind:checked={device.features[feature.key]}
    />
  </Row>
{/each}
