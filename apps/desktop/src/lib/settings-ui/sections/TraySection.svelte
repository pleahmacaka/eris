<script lang="ts">
  import { installUsageBridge, usageBridgeInstalled } from "$lib/native/usage"
  import { type ClockAlign, type DeviceSettings, defaultDevice } from "@eris/settings"
  import { Row, Section, Segmented, toast } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { reset } from "../reset"

  let { device = $bindable() }: { device: DeviceSettings } = $props()

  const resetRow = reset(() => device, defaultDevice)

  type Toggle =
    | "showTrayIcons"
    | "showVolume"
    | "showBattery"
    | "showMeters"
    | "showNetwork"
    | "showBluetooth"
    | "showInputLanguage"
    | "showNotifications"
    | "showTaskView"
    | "showDesktopButton"
    | "showSettingsButton"
    | "clock24h"
    | "showSeconds"
    | "showMedia"
    | "showSpectrum"
    | "showClaudeUsage"
    | "claudeUsageStacked"

  const ITEMS: Toggle[] = [
    "showTrayIcons",
    "showVolume",
    "showBattery",
    "showMeters",
    "showNetwork",
    "showBluetooth",
    "showInputLanguage",
    "showNotifications",
    "showTaskView",
    "showDesktopButton",
    "showSettingsButton",
  ]

  const PARTIAL = new Set<Toggle>(["showNetwork", "showBluetooth", "showNotifications"])

  const CLOCK_ALIGNMENTS: { value: ClockAlign; icon: string }[] = [
    { value: "start", icon: "lucide:align-left" },
    { value: "center", icon: "lucide:align-center" },
    { value: "end", icon: "lucide:align-right" },
  ]

  const clockAlignments = $derived(
    CLOCK_ALIGNMENTS.map(a => ({
      ...a,
      label: $t(`settings.dock.align${a.value[0].toUpperCase()}${a.value.slice(1)}`),
    })),
  )

  const sides = $derived([
    { value: "left" as const, label: $t("settings.dock.left"), icon: "lucide:align-start-horizontal" },
    { value: "right" as const, label: $t("settings.dock.right"), icon: "lucide:align-end-horizontal" },
  ])

  let bridged = $state(false)
  let bridging = $state(false)

  const readBridge = () => {
    usageBridgeInstalled()
      .then(value => {
        bridged = value
      })
      .catch(() => undefined)
  }

  $effect(() => {
    readBridge()
  })

  const toggleBridge = async () => {
    bridging = true
    await installUsageBridge(!bridged).catch(error =>
      toast(
        $t("settings.toasts.bridgeFailed", {
          values: { error: error instanceof Error ? error.message : String(error) },
        }),
        "error",
      ),
    )
    readBridge()
    bridging = false
  }
</script>

{#snippet toggle(key: Toggle)}
  <Row
    label={$t(`settings.rows.${key}`)}
    hint={$t(`settings.hints.${key}`)}
    tag={PARTIAL.has(key) ? "partial" : undefined}
    onreset={resetRow(key)}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t(`settings.rows.${key}`)}
      bind:checked={device[key]}
    />
  </Row>
{/snippet}

{#if !device.features.dock}
  <div role="note" class="alert alert-soft alert-info text-sm">
    {$t("settings.hints.trayNeedsDock")}
  </div>
{/if}

<fieldset
  class={[
    "flex flex-col gap-4 transition-opacity duration-100",
    !device.features.dock && "opacity-40",
  ]}
  disabled={!device.features.dock}
>
  <Section title={$t("settings.groups.trayItems")}>
    {#each ITEMS as key (key)}
      {@render toggle(key)}
    {/each}
  </Section>

  <Section title={$t("settings.groups.clock")}>
    {@render toggle("clock24h")}
    {@render toggle("showSeconds")}

    <Row
      label={$t("settings.rows.clockAlign")}
      hint={$t("settings.hints.clockAlign")}
      onreset={resetRow("clockAlign")}
    >
      <Segmented
        label={$t("settings.rows.clockAlign")}
        bind:value={device.clockAlign}
        options={clockAlignments}
      />
    </Row>
  </Section>

  <Section title={$t("settings.groups.media")}>
    {@render toggle("showMedia")}

    {#if device.showMedia}
      <Row
        label={$t("settings.rows.mediaSide")}
        hint={$t("settings.hints.mediaSide")}
        onreset={resetRow("mediaSide")}
      >
        <Segmented label={$t("settings.rows.mediaSide")} bind:value={device.mediaSide} options={sides} />
      </Row>

      {@render toggle("showSpectrum")}

      {#if device.showSpectrum}
        <Row
          label={$t("settings.rows.spectrumStyle")}
          hint={$t("settings.hints.spectrumStyle")}
          onreset={resetRow("spectrumStyle")}
        >
          <Segmented
            label={$t("settings.rows.spectrumStyle")}
            bind:value={device.spectrumStyle}
            options={[
              { value: "bars", label: $t("settings.dock.bars") },
              { value: "mirror", label: $t("settings.dock.mirror") },
              { value: "wave", label: $t("settings.dock.wave") },
              { value: "dots", label: $t("settings.dock.dots") },
            ]}
          />
        </Row>
      {/if}
    {/if}
  </Section>

  <Section title={$t("settings.groups.claude")}>
    {@render toggle("showClaudeUsage")}

    {#if device.showClaudeUsage}
      <Row
        label={$t("settings.rows.claudeUsageSide")}
        hint={$t("settings.hints.claudeUsageSide")}
        onreset={resetRow("claudeUsageSide")}
      >
        <Segmented
          label={$t("settings.rows.claudeUsageSide")}
          bind:value={device.claudeUsageSide}
          options={sides}
        />
      </Row>

      {@render toggle("claudeUsageStacked")}

      <Row label={$t("settings.rows.claudeBridge")} hint={$t("settings.hints.claudeBridge")}>
        <button
          type="button"
          class={["btn btn-sm", bridged ? "btn-ghost" : "btn-primary"]}
          disabled={bridging}
          onclick={toggleBridge}
        >
          {bridged ? $t("settings.dock.disconnect") : $t("settings.dock.connect")}
        </button>
      </Row>

      {#if !bridged}
        <Row
          label={$t("settings.rows.usageSnapshot")}
          hint={$t("settings.hints.usageSnapshot")}
          stacked
          onreset={resetRow("claudeUsageSource")}
        >
          <input
            class="input input-sm w-full"
            type="text"
            aria-label={$t("settings.rows.usageSnapshot")}
            placeholder="~/.claude/eris-usage.json"
            bind:value={device.claudeUsageSource}
          />
        </Row>
      {/if}
    {/if}
  </Section>
</fieldset>
