<script lang="ts">
  import Icon from "@iconify/svelte"
  import { live } from "$lib/data/live.svelte"
  import { newId, presets as userPresets } from "$lib/data/store"
  import type { Appearance, Profile } from "$lib/settings"
  import { allPresets, CUSTOM } from "./presets"
  import Row from "./Row.svelte"
  import Segmented from "./Segmented.svelte"
  import { toast } from "./toast.svelte"
  import { t } from "svelte-i18n"

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
    | "dockBlur"
    | "dockRadius"
    | "dockTint"

  type Slider = {
    key: NumberKey
    row: string
    min: number
    max: number
    step: number
    format: (v: number) => string
  }

  const percent = (v: number) => `${Math.round(v * 100)}%`
  const times = (v: number) => `${v.toFixed(2)}x`

  const sliders: Slider[] = [
    { key: "accentSpread", row: "colorSpread", min: 0, max: 120, step: 1, format: v => `${v}°` },
    { key: "vividness", row: "vividness", min: 0, max: 0.25, step: 0.01, format: v => percent(v / 0.25) },
    { key: "texture", row: "texture", min: 0, max: 1, step: 0.05, format: percent },
    { key: "radius", row: "cornerRadius", min: 0, max: 2, step: 0.05, format: times },
    { key: "blur", row: "blur", min: 0, max: 2, step: 0.05, format: times },
    { key: "fontScale", row: "fontSize", min: 0.85, max: 1.25, step: 0.05, format: percent },
    { key: "surfaceOpacity", row: "windowOpacity", min: 0.6, max: 1, step: 0.02, format: percent },
  ]

  const dockSliders: Slider[] = [
    { key: "dockOpacity", row: "dockOpacity", min: 0.6, max: 1, step: 0.02, format: percent },
    { key: "dockBlur", row: "dockBlur", min: 0, max: 2, step: 0.05, format: times },
    { key: "dockRadius", row: "dockRadius", min: 0, max: 2, step: 0.05, format: times },
    { key: "dockTint", row: "dockTint", min: 0, max: 0.4, step: 0.02, format: v => percent(v / 0.4) },
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
    toast($t("settings.toasts.presetSaved", { values: { name: title } }), "success")
  }
</script>

<Row label={$t("settings.rows.mode")} hint={$t("settings.hints.mode")}>
  <Segmented
    label={$t("settings.rows.mode")}
    bind:value={profile.appearance.mode}
    onchange={markCustom}
    options={[
      { value: "dark", label: $t("settings.options.dark"), icon: "lucide:moon" },
      { value: "light", label: $t("settings.options.light"), icon: "lucide:sun" },
      { value: "system", label: $t("settings.options.system"), icon: "lucide:monitor" },
    ]}
  />
</Row>

<Row label={$t("settings.rows.background")} hint={$t("settings.hints.background")}>
  <Segmented
    label={$t("settings.rows.background")}
    bind:value={profile.appearance.background}
    onchange={markCustom}
    options={[
      { value: "aura", label: $t("settings.options.aura") },
      { value: "glass", label: $t("settings.options.glass") },
      { value: "solid", label: $t("settings.options.solid") },
    ]}
  />
</Row>

<Row label={$t("settings.rows.followAccent")} hint={$t("settings.hints.followAccent")}>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label={$t("settings.rows.followAccent")}
    bind:checked={profile.appearance.useSystemAccent}
    onchange={markCustom}
  />
</Row>

<Row
  label={$t("settings.rows.accentHue")}
  hint={profile.appearance.useSystemAccent
    ? $t("settings.appearance.followingAccent")
    : $t("settings.appearance.baseColor")}
  value="{profile.appearance.accentHue}°"
  stacked
>
  <input
    type="range"
    class="hue w-full"
    min="0"
    max="360"
    step="1"
    aria-label={$t("settings.rows.accentHue")}
    style="--hue: {profile.appearance.accentHue}"
    disabled={profile.appearance.useSystemAccent}
    bind:value={profile.appearance.accentHue}
    oninput={markCustom}
  />
</Row>

{#each sliders as s (s.key)}
  <Row
    label={$t(`settings.rows.${s.row}`)}
    hint={$t(`settings.hints.${s.row}`)}
    value={s.format(profile.appearance[s.key])}
    stacked
  >
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min={s.min}
      max={s.max}
      step={s.step}
      aria-label={$t(`settings.rows.${s.row}`)}
      bind:value={profile.appearance[s.key]}
      oninput={markCustom}
    />
  </Row>
{/each}

<div class="flex flex-col px-4 pt-4 pb-1">
  <span class="text-sm font-semibold">{$t("settings.groups.dockLook.title")}</span>

  <span class="text-xs text-base-content/60">{$t("settings.groups.dockLook.description")}</span>
</div>

<Row label={$t("settings.rows.dockBackground")} hint={$t("settings.hints.dockBackground")}>
  <Segmented
    label={$t("settings.rows.dockBackground")}
    bind:value={profile.appearance.dockBackground}
    onchange={markCustom}
    options={[
      { value: "inherit", label: $t("settings.options.inherit") },
      { value: "aura", label: $t("settings.options.aura") },
      { value: "glass", label: $t("settings.options.glass") },
      { value: "solid", label: $t("settings.options.solid") },
    ]}
  />
</Row>

{#each dockSliders as s (s.key)}
  <Row
    label={$t(`settings.rows.${s.row}`)}
    hint={$t(`settings.hints.${s.row}`)}
    value={s.format(profile.appearance[s.key])}
    stacked
  >
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min={s.min}
      max={s.max}
      step={s.step}
      aria-label={$t(`settings.rows.${s.row}`)}
      bind:value={profile.appearance[s.key]}
      oninput={markCustom}
    />
  </Row>
{/each}

<Row label={$t("settings.rows.dockBorder")} hint={$t("settings.hints.dockBorder")}>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label={$t("settings.rows.dockBorder")}
    bind:checked={profile.appearance.dockBorder}
    onchange={markCustom}
  />
</Row>

<Row label={$t("settings.rows.dockAura")} hint={$t("settings.hints.dockAura")}>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label={$t("settings.rows.dockAura")}
    bind:checked={profile.appearance.dockAura}
    onchange={markCustom}
  />
</Row>

<Row label={$t("settings.rows.density")} hint={$t("settings.hints.density")}>
  <Segmented
    label={$t("settings.rows.density")}
    bind:value={profile.appearance.density}
    onchange={markCustom}
    options={[
      { value: "cozy", label: $t("settings.options.cozy") },
      { value: "compact", label: $t("settings.options.compact") },
    ]}
  />
</Row>

<Row label={$t("settings.rows.motion")} hint={$t("settings.hints.motion")}>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label={$t("settings.rows.motion")}
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
    {$t("settings.appearance.resetTo", {
      values: { name: basePreset?.name ?? $t("settings.appearance.preset") },
    })}
  </button>

  <button type="button" class="btn btn-primary btn-sm" onclick={openSave}>
    <Icon icon="lucide:bookmark-plus" class="size-4" />
    {$t("settings.appearance.saveAsPreset")}
  </button>
</div>

<dialog bind:this={dialog} class="modal">
  <form
    method="dialog"
    class="modal-box max-w-sm border border-base-content/10 bg-base-100/90 backdrop-blur-xl"
    onsubmit={save}
  >
    <h3 class="text-base font-semibold">{$t("settings.appearance.savePreset")}</h3>

    <p class="mt-1 text-sm text-base-content/70">
      {$t("settings.appearance.savePresetBody")}
    </p>

    <input
      class="input mt-4 w-full"
      placeholder={$t("settings.appearance.presetName")}
      aria-label={$t("settings.appearance.presetName")}
      maxlength="40"
      bind:value={name}
    />

    <div class="modal-action">
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        onclick={() => dialog?.close()}
      >
        {$t("common.cancel")}
      </button>

      <button
        type="submit"
        class="btn btn-primary btn-sm"
        disabled={!name.trim()}
      >
        {$t("common.save")}
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
