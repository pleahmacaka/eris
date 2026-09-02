<script lang="ts">
  import Icon from "@iconify/svelte"
  import { live } from "$lib/data/live.svelte"
  import { newId, presets as userPresets } from "$lib/data/store"
  import type { Appearance, Profile } from "$lib/settings"
  import { allPresets, CUSTOM } from "./presets"
  import Row from "./Row.svelte"
  import Segmented from "./Segmented.svelte"
  import { toast } from "./toast.svelte"

  let { profile = $bindable() }: { profile: Profile } = $props()

  type NumberKey =
    | "accentSpread"
    | "vividness"
    | "texture"
    | "radius"
    | "blur"
    | "fontScale"
    | "surfaceOpacity"
    | "dockOpacity"

  type Slider = {
    key: NumberKey
    label: string
    hint: string
    min: number
    max: number
    step: number
    format: (v: number) => string
  }

  const percent = (v: number) => `${Math.round(v * 100)}%`
  const times = (v: number) => `${v.toFixed(2)}x`

  const sliders: Slider[] = [
    {
      key: "accentSpread",
      label: "Color spread",
      hint: "Hue distance between the accent colors",
      min: 0,
      max: 120,
      step: 1,
      format: v => `${v} deg`,
    },
    {
      key: "vividness",
      label: "Vividness",
      hint: "Color soaked into surfaces",
      min: 0,
      max: 0.25,
      step: 0.01,
      format: v => percent(v / 0.25),
    },
    {
      key: "texture",
      label: "Texture",
      hint: "Grain over the background",
      min: 0,
      max: 1,
      step: 0.05,
      format: percent,
    },
    {
      key: "radius",
      label: "Corner radius",
      hint: "Roundness of every surface",
      min: 0,
      max: 2,
      step: 0.05,
      format: times,
    },
    {
      key: "blur",
      label: "Blur",
      hint: "Strength of the frosted glass",
      min: 0,
      max: 2,
      step: 0.05,
      format: times,
    },
    {
      key: "fontScale",
      label: "Font size",
      hint: "Scales all text",
      min: 0.85,
      max: 1.25,
      step: 0.05,
      format: percent,
    },
    {
      key: "surfaceOpacity",
      label: "Window opacity",
      hint: "Opacity of every Eris window",
      min: 0.6,
      max: 1,
      step: 0.02,
      format: percent,
    },
    {
      key: "dockOpacity",
      label: "Dock opacity",
      hint: "Opacity of the dock band",
      min: 0.6,
      max: 1,
      step: 0.02,
      format: percent,
    },
  ]

  const user = live(userPresets)

  $effect(() => () => user.stop())

  let base = $state(profile.presetId === CUSTOM ? "aurora" : profile.presetId)

  $effect(() => {
    if (profile.presetId !== CUSTOM) {
      base = profile.presetId
    }
  })

  const basePreset = $derived(allPresets(user.items).find(p => p.id === base))

  const markCustom = () => {
    profile.presetId = CUSTOM
  }

  const reset = () => {
    if (basePreset) {
      profile.appearance = { ...basePreset.appearance }
      profile.presetId = basePreset.id
    }
  }

  let dialog = $state<HTMLDialogElement>()
  let name = $state("")

  const openSave = () => {
    name = ""
    dialog?.showModal()
  }

  const save = async (e: SubmitEvent) => {
    e.preventDefault()

    const title = name.trim()

    if (!title) {
      return
    }

    const appearance = $state.snapshot(profile.appearance) as Appearance
    const id = newId()

    await userPresets.put({
      id,
      name: title,
      appearance,
      createdAt: Date.now(),
      updatedAt: 0,
    })

    profile.presetId = id
    dialog?.close()
    toast(`Saved preset "${title}"`, "success")
  }
</script>

<Row label="Mode" hint="Dark, light, or follow Windows">
  <Segmented
    label="Mode"
    bind:value={profile.appearance.mode}
    onchange={markCustom}
    options={[
      { value: "dark", label: "Dark", icon: "lucide:moon" },
      { value: "light", label: "Light", icon: "lucide:sun" },
      { value: "system", label: "System", icon: "lucide:monitor" },
    ]}
  />
</Row>

<Row label="Background" hint="Surface treatment behind every window">
  <Segmented
    label="Background"
    bind:value={profile.appearance.background}
    onchange={markCustom}
    options={[
      { value: "aura", label: "Aura" },
      { value: "glass", label: "Glass" },
      { value: "solid", label: "Solid" },
    ]}
  />
</Row>

<Row
  label="Follow Windows accent"
  hint="Use the accent color from Windows settings"
>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label="Follow Windows accent"
    bind:checked={profile.appearance.useSystemAccent}
    onchange={markCustom}
  />
</Row>

<Row
  label="Accent hue"
  hint={profile.appearance.useSystemAccent
    ? "Following the Windows accent"
    : "Base color for the whole theme"}
  value="{profile.appearance.accentHue} deg"
  stacked
>
  <input
    type="range"
    class="hue w-full"
    min="0"
    max="360"
    step="1"
    aria-label="Accent hue"
    style="--hue: {profile.appearance.accentHue}"
    disabled={profile.appearance.useSystemAccent}
    bind:value={profile.appearance.accentHue}
    oninput={markCustom}
  />
</Row>

{#each sliders as s (s.key)}
  <Row
    label={s.label}
    hint={s.hint}
    value={s.format(profile.appearance[s.key])}
    stacked
  >
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min={s.min}
      max={s.max}
      step={s.step}
      aria-label={s.label}
      bind:value={profile.appearance[s.key]}
      oninput={markCustom}
    />
  </Row>
{/each}

<Row label="Density" hint="Spacing inside lists and buttons">
  <Segmented
    label="Density"
    bind:value={profile.appearance.density}
    onchange={markCustom}
    options={[
      { value: "cozy", label: "Cozy" },
      { value: "compact", label: "Compact" },
    ]}
  />
</Row>

<Row label="Motion" hint="Animated backgrounds and transitions">
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label="Motion"
    bind:checked={profile.appearance.motion}
    onchange={markCustom}
  />
</Row>

<div class="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
  <button
    type="button"
    class="btn btn-ghost btn-sm"
    disabled={!basePreset || profile.presetId === basePreset.id}
    onclick={reset}
  >
    <Icon icon="lucide:rotate-ccw" class="size-4" />
    Reset to {basePreset?.name ?? "preset"}
  </button>

  <button type="button" class="btn btn-primary btn-sm" onclick={openSave}>
    <Icon icon="lucide:bookmark-plus" class="size-4" />
    Save as preset
  </button>
</div>

<dialog bind:this={dialog} class="modal">
  <form
    method="dialog"
    class="modal-box max-w-sm border border-base-content/10 bg-base-100/90 backdrop-blur-xl"
    onsubmit={save}
  >
    <h3 class="text-base font-semibold">Save preset</h3>

    <p class="mt-1 text-sm text-base-content/70">
      Keeps the current appearance as a card in the grid.
    </p>

    <input
      class="input mt-4 w-full"
      placeholder="Preset name"
      aria-label="Preset name"
      maxlength="40"
      bind:value={name}
    />

    <div class="modal-action">
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        onclick={() => dialog?.close()}
      >
        Cancel
      </button>

      <button
        type="submit"
        class="btn btn-primary btn-sm"
        disabled={!name.trim()}
      >
        Save
      </button>
    </div>
  </form>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">close</button>
  </form>
</dialog>

<style>
  .hue {
    appearance: none;
    height: 0.75rem;
    border-radius: 9999px;
    background: linear-gradient(
      to right,
      oklch(70% 0.15 0),
      oklch(70% 0.15 60),
      oklch(70% 0.15 120),
      oklch(70% 0.15 180),
      oklch(70% 0.15 240),
      oklch(70% 0.15 300),
      oklch(70% 0.15 360)
    );
    outline: none;
    transition: opacity 150ms;
  }

  .hue:disabled {
    opacity: 0.35;
  }

  .hue::-webkit-slider-thumb {
    appearance: none;
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 50%;
    background: oklch(70% 0.15 var(--hue));
    border: 2px solid var(--color-base-100);
    box-shadow: 0 0 0 1px
      color-mix(in oklch, var(--color-base-content) 25%, transparent);
    cursor: pointer;
  }

  .hue:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px
      color-mix(in oklch, var(--color-primary) 50%, transparent);
  }
</style>
