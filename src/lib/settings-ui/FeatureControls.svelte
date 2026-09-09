<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { DeviceSettings } from "$lib/settings"
  import Row from "./Row.svelte"

  type Feature = keyof DeviceSettings["features"]

  type Preset = {
    id: string
    name: string
    hint: string
    icon: string
    features: DeviceSettings["features"]
  }

  let {
    device = $bindable(),
    presets = false,
  }: { device: DeviceSettings; presets?: boolean } = $props()

  const FEATURES: { key: Feature; label: string; hint: string; icon: string }[] = [
    { key: "dock", label: "Dock", hint: "The bar that replaces the Windows taskbar", icon: "lucide:panel-bottom" },
    { key: "launcher", label: "Launcher", hint: "Win key search for apps, windows, and commands", icon: "lucide:search" },
    { key: "chat", label: "Chat bubble", hint: "Claude and Claude Code in a floating bubble", icon: "lucide:message-circle" },
  ]

  const PRESETS: Preset[] = [
    { id: "all", name: "Everything", hint: "Dock, launcher, and chat", icon: "lucide:layout-grid", features: { dock: true, launcher: true, chat: true } },
    { id: "desk", name: "Desk", hint: "Dock and launcher, no chat", icon: "lucide:panel-bottom", features: { dock: true, launcher: true, chat: false } },
    { id: "search", name: "Launcher only", hint: "Keep the Windows taskbar", icon: "lucide:search", features: { dock: false, launcher: true, chat: false } },
    { id: "bubble", name: "Chat only", hint: "Just the Claude bubble", icon: "lucide:message-circle", features: { dock: false, launcher: false, chat: true } },
  ]

  const same = (a: DeviceSettings["features"], b: DeviceSettings["features"]) =>
    a.dock === b.dock && a.launcher === b.launcher && a.chat === b.chat
</script>

{#if presets}
  <div class="grid grid-cols-2 gap-3 px-4 pt-3" role="radiogroup" aria-label="Feature preset">
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
          <span class="block text-sm font-medium">{preset.name}</span>

          <span class="block text-xs text-base-content/60">{preset.hint}</span>
        </span>
      </button>
    {/each}
  </div>
{/if}

{#each FEATURES as feature (feature.key)}
  <Row label={feature.label} hint={feature.hint}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={feature.label}
      bind:checked={device.features[feature.key]}
    />
  </Row>
{/each}
