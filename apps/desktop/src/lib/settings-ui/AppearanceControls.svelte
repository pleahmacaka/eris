<script lang="ts">
  import Icon from "@iconify/svelte"
  import { live, newId, presets as userPresets } from "$lib/data"
  import {
    type Appearance,
    type DockBackground,
    type Profile,
    defaultAppearance,
    defaultProfile,
    WINDOW_BACKGROUNDS,
  } from "@eris/settings"
  import { allPresets, CUSTOM, sameAppearance } from "./presets"
  import { reset as resetField } from "./reset"
  import { AppearanceRows, Row, Section, Segmented } from "@eris/ui"
  import { toast } from "@eris/ui"
  import { t } from "svelte-i18n"

  let {
    profile = $bindable(),
    part = "theme",
  }: { profile: Profile; part?: "theme" | "dock" } = $props()

  type NumberKey = "dockOpacity" | "dockBlur" | "dockRadius" | "dockTint"

  type Slider = {
    key: NumberKey
    row: string
    min: number
    max: number
    step: number
    format: (v: number) => string
  }

  const BACKGROUND_CHOICES: DockBackground[] = ["inherit", "solid", "aura", "glass"]

  const percent = (v: number) => `${Math.round(v * 100)}%`
  const times = (v: number) => `${v.toFixed(2)}x`

  const dockSliders: Slider[] = [
    { key: "dockOpacity", row: "dockOpacity", min: 0.6, max: 1, step: 0.02, format: percent },
    { key: "dockBlur", row: "dockBlur", min: 0, max: 2, step: 0.05, format: times },
    { key: "dockRadius", row: "dockRadius", min: 0, max: 2, step: 0.05, format: times },
    { key: "dockTint", row: "dockTint", min: 0, max: 0.4, step: 0.02, format: v => percent(v / 0.4) },
  ]

  const user = live(userPresets)

  $effect(() => () => user.stop())

  let base = $state(
    profile.presetId === CUSTOM ? defaultProfile.presetId : profile.presetId,
  )

  $effect(() => {
    if (profile.presetId !== CUSTOM) {
      base = profile.presetId
    }
  })

  const basePreset = $derived(allPresets(user.items).find(p => p.id === base))

  const markCustom = () => {
    profile.presetId = CUSTOM
  }

  const resetRow = (key: keyof Appearance) => () => {
    const target = basePreset?.appearance ?? defaultAppearance

    resetField(() => profile.appearance, target)(key)()

    if (basePreset && sameAppearance(profile.appearance, basePreset.appearance)) {
      profile.presetId = basePreset.id
    } else {
      markCustom()
    }
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

{#snippet slider(s: Slider)}
  <Row
    label={$t(`settings.rows.${s.row}`)}
    hint={$t(`settings.hints.${s.row}`)}
    value={s.format(profile.appearance[s.key])}
    stacked
    onreset={resetRow(s.key)}
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
{/snippet}

{#if part === "dock"}
  <Row
    label={$t("settings.rows.dockBackground")}
    hint={$t("settings.hints.dockBackground")}
    onreset={resetRow("dockBackground")}
  >
    <Segmented
      label={$t("settings.rows.dockBackground")}
      bind:value={profile.appearance.dockBackground}
      onchange={markCustom}
      options={[
        { value: "inherit", label: $t("settings.options.inherit") },
        { value: "solid", label: $t("settings.options.solid") },
        { value: "aura", label: $t("settings.options.aura") },
        { value: "glass", label: $t("settings.options.glass") },
      ]}
    />
  </Row>

  {#each dockSliders as s (s.key)}
    {@render slider(s)}
  {/each}

  <Row
    label={$t("settings.rows.dockBorder")}
    hint={$t("settings.hints.dockBorder")}
    onreset={resetRow("dockBorder")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.dockBorder")}
      bind:checked={profile.appearance.dockBorder}
      onchange={markCustom}
    />
  </Row>
{:else}
  <AppearanceRows
    bind:appearance={profile.appearance}
    groups={["color", "surface"]}
    onchange={markCustom}
    onreset={key => resetRow(key)()}
  />

  <Section
    title={$t("settings.groups.windowBackgrounds.title")}
    description={$t("settings.groups.windowBackgrounds.description")}
  >
    {#each Object.values(WINDOW_BACKGROUNDS) as key (key)}
      <Row label={$t(`settings.rows.${key}`)} onreset={resetRow(key)}>
        <select
          class="select select-sm w-40"
          aria-label={$t(`settings.rows.${key}`)}
          bind:value={profile.appearance[key]}
          onchange={markCustom}
        >
          {#each BACKGROUND_CHOICES as choice (choice)}
            <option value={choice}>{$t(`settings.options.${choice}`)}</option>
          {/each}
        </select>
      </Row>
    {/each}
  </Section>

  <AppearanceRows
    bind:appearance={profile.appearance}
    groups={["type"]}
    onchange={markCustom}
    onreset={key => resetRow(key)()}
  />

  <div class="flex flex-wrap items-center justify-end gap-2">
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
{/if}

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
