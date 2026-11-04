<script lang="ts">
  import { type Appearance, SYSTEM_FONT } from "@eris/settings"
  import { t } from "svelte-i18n"
  import Row from "../forms/Row.svelte"
  import Section from "../forms/Section.svelte"
  import Segmented from "../forms/Segmented.svelte"

  type Group = "color" | "surface" | "type"

  type NumberKey =
    | "accentSpread"
    | "vividness"
    | "texture"
    | "radius"
    | "blur"
    | "fontScale"
    | "surfaceOpacity"

  type Slider = {
    key: NumberKey
    row: string
    min: number
    max: number
    step: number
    format: (v: number) => string
  }

  type FontChoice = "default" | "system" | "custom"

  let {
    appearance = $bindable(),
    groups = ["color", "surface", "type"],
    essential = false,
    onchange,
    onreset,
    pinnable = false,
  }: {
    appearance: Appearance
    groups?: Group[]
    essential?: boolean
    onchange?: () => void
    onreset?: (key: keyof Appearance) => void
    pinnable?: boolean
  } = $props()

  const percent = (v: number) => `${Math.round(v * 100)}%`
  const times = (v: number) => `${v.toFixed(2)}x`

  const colorSliders: Slider[] = [
    { key: "accentSpread", row: "colorSpread", min: 0, max: 120, step: 1, format: v => `${v}°` },
    { key: "vividness", row: "vividness", min: 0, max: 0.25, step: 0.01, format: v => percent(v / 0.25) },
  ]

  const surfaceSliders: Slider[] = [
    { key: "surfaceOpacity", row: "windowOpacity", min: 0.6, max: 1, step: 0.02, format: percent },
    { key: "blur", row: "blur", min: 0, max: 2, step: 0.05, format: times },
    { key: "texture", row: "texture", min: 0, max: 1, step: 0.05, format: percent },
    { key: "radius", row: "cornerRadius", min: 0, max: 2, step: 0.05, format: times },
  ]

  const SWATCHES = [215, 260, 300, 340, 20, 60, 140, 180]

  const appearanceRow = (key: keyof Appearance) => ({
    onreset: onreset ? () => onreset(key) : undefined,
    pin: pinnable ? (`appearance.${key}` as const) : undefined,
  })

  const savedChoice = $derived<FontChoice>(
    !appearance.font ? "default" : appearance.font === SYSTEM_FONT ? "system" : "custom",
  )

  let customFont = $state("")
  let wantCustom = $state(false)

  const fontChoice = $derived<FontChoice>(wantCustom ? "custom" : savedChoice)

  const applyFont = (font: string) => {
    appearance.font = font
    onchange?.()
  }

  const pickFont = (choice: FontChoice) => {
    wantCustom = choice === "custom"

    if (choice !== "custom") {
      applyFont(choice === "system" ? SYSTEM_FONT : "")
    } else if (customFont.trim()) {
      applyFont(customFont.trim())
    }
  }

  const setHue = (hue: number) => {
    appearance.accentHue = hue
    appearance.useSystemAccent = false
    onchange?.()
  }

  $effect(() => {
    const custom = savedChoice === "custom"

    if (custom) {
      customFont = appearance.font
    }

    wantCustom = custom
  })
</script>

{#snippet slider(s: Slider)}
  <Row
    label={$t(`settings.rows.${s.row}`)}
    hint={s.key === "blur" && appearance.background === "glass"
      ? $t("settings.hints.blurGlass")
      : $t(`settings.hints.${s.row}`)}
    value={s.format(appearance[s.key])}
    stacked
    {...appearanceRow(s.key)}
  >
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min={s.min}
      max={s.max}
      step={s.step}
      aria-label={$t(`settings.rows.${s.row}`)}
      bind:value={appearance[s.key]}
      oninput={onchange}
    />
  </Row>
{/snippet}

{#if groups.includes("color")}
  <Section title={$t("settings.groups.color")}>
    <Row
      label={$t("settings.rows.mode")}
      hint={$t("settings.hints.mode")}
      {...appearanceRow("mode")}
    >
      <Segmented
        label={$t("settings.rows.mode")}
        bind:value={appearance.mode}
        onchange={onchange}
        options={[
          { value: "dark", label: $t("settings.options.dark"), icon: "lucide:moon" },
          { value: "light", label: $t("settings.options.light"), icon: "lucide:sun" },
          { value: "system", label: $t("settings.options.system"), icon: "lucide:monitor" },
        ]}
      />
    </Row>

    {#if !essential}
      <Row
        label={$t("settings.rows.followAccent")}
        hint={$t("settings.hints.followAccent")}
        {...appearanceRow("useSystemAccent")}
      >
        <input
          type="checkbox"
          class="toggle toggle-primary"
          aria-label={$t("settings.rows.followAccent")}
          bind:checked={appearance.useSystemAccent}
          onchange={onchange}
        />
      </Row>
    {/if}

    <Row
      label={$t("settings.rows.accentHue")}
      hint={appearance.useSystemAccent
        ? $t("settings.appearance.followingAccent")
        : $t("settings.appearance.baseColor")}
      value="{appearance.accentHue}°"
      stacked
      {...appearanceRow("accentHue")}
    >
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap gap-2">
          {#each SWATCHES as hue (hue)}
            <button
              type="button"
              class={[
                "size-6 cursor-pointer rounded-full ring-2 ring-offset-2 ring-offset-base-100 transition-shadow duration-100",
                !appearance.useSystemAccent && appearance.accentHue === hue
                  ? "ring-base-content/80"
                  : "ring-transparent hover:ring-base-content/25",
              ]}
              style:background="oklch(70% 0.15 {hue})"
              aria-label="{hue}°"
              aria-pressed={!appearance.useSystemAccent && appearance.accentHue === hue}
              onclick={() => setHue(hue)}
            ></button>
          {/each}
        </div>

        <input
          type="range"
          class={[
            "h-3 w-full appearance-none rounded-full outline-none",
            "transition-opacity duration-120 disabled:opacity-35",
            "bg-[linear-gradient(to_right,oklch(70%_0.15_0),oklch(70%_0.15_60),oklch(70%_0.15_120),oklch(70%_0.15_180),oklch(70%_0.15_240),oklch(70%_0.15_300),oklch(70%_0.15_360))]",
            "[&::-webkit-slider-thumb]:size-4.5",
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:cursor-pointer",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:border-2",
            "[&::-webkit-slider-thumb]:border-base-100",
            "[&::-webkit-slider-thumb]:bg-[oklch(70%_0.15_var(--hue))]",
            "[&::-webkit-slider-thumb]:ring-1",
            "[&::-webkit-slider-thumb]:ring-base-content/25",
            "focus-visible:[&::-webkit-slider-thumb]:ring-3",
            "focus-visible:[&::-webkit-slider-thumb]:ring-primary/50",
          ]}
          min="0"
          max="360"
          step="1"
          aria-label={$t("settings.rows.accentHue")}
          style="--hue: {appearance.accentHue}"
          disabled={appearance.useSystemAccent}
          bind:value={appearance.accentHue}
          oninput={onchange}
        />
      </div>
    </Row>

    {#if !essential}
      {#each colorSliders as s (s.key)}
        {@render slider(s)}
      {/each}
    {/if}
  </Section>
{/if}

{#if groups.includes("surface")}
  <Section title={$t("settings.groups.surface")}>
    <Row
      label={$t("settings.rows.background")}
      hint={$t("settings.hints.background")}
      {...appearanceRow("background")}
    >
      <Segmented
        label={$t("settings.rows.background")}
        bind:value={appearance.background}
        onchange={onchange}
        options={[
          { value: "solid", label: $t("settings.options.solid") },
          { value: "aura", label: $t("settings.options.aura") },
          { value: "glass", label: $t("settings.options.glass") },
        ]}
      />
    </Row>

    {#if !essential}
      {#each surfaceSliders as s (s.key)}
        {@render slider(s)}
      {/each}
    {/if}
  </Section>
{/if}

{#if groups.includes("type")}
  <Section title={$t("settings.groups.typeMotion")}>
    <Row
      label={$t("settings.rows.font")}
      hint={$t("settings.hints.font")}
      stacked
      {...appearanceRow("font")}
    >
      <div class="flex flex-col gap-2">
        <Segmented
          label={$t("settings.rows.font")}
          value={fontChoice}
          onchange={pickFont}
          options={[
            { value: "default", label: "Pretendard" },
            { value: "system", label: $t("settings.options.systemFont") },
            { value: "custom", label: $t("settings.options.customFont") },
          ]}
        />

        {#if fontChoice === "custom"}
          <input
            class="input input-sm w-full"
            placeholder={$t("settings.appearance.fontName")}
            aria-label={$t("settings.appearance.fontName")}
            spellcheck="false"
            bind:value={customFont}
            onchange={() => customFont.trim() && applyFont(customFont.trim())}
          />
        {/if}
      </div>
    </Row>

    {#if !essential}
      {@render slider({
        key: "fontScale",
        row: "fontSize",
        min: 0.85,
        max: 1.25,
        step: 0.05,
        format: percent,
      })}

      <Row
        label={$t("settings.rows.density")}
        hint={$t("settings.hints.density")}
        {...appearanceRow("density")}
      >
        <Segmented
          label={$t("settings.rows.density")}
          bind:value={appearance.density}
          onchange={onchange}
          options={[
            { value: "cozy", label: $t("settings.options.cozy") },
            { value: "compact", label: $t("settings.options.compact") },
          ]}
        />
      </Row>

      <Row
        label={$t("settings.rows.motion")}
        hint={$t("settings.hints.motion")}
        {...appearanceRow("motion")}
      >
        <input
          type="checkbox"
          class="toggle toggle-primary"
          aria-label={$t("settings.rows.motion")}
          bind:checked={appearance.motion}
          onchange={onchange}
        />
      </Row>
    {/if}
  </Section>
{/if}
