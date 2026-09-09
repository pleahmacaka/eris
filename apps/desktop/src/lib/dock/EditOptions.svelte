<script lang="ts">
  import { t } from "svelte-i18n"
  import { Segmented } from "@eris/ui"
  import type {
    ClockAlign,
    DeviceSettings,
    DockAlign,
    DockSide,
    DockStyle,
    LauncherTrigger,
  } from "@eris/settings"
  import type { DockLayout } from "./layout.svelte"

  type BoolKey = {
    [K in keyof DeviceSettings]: DeviceSettings[K] extends boolean ? K : never
  }[keyof DeviceSettings]

  type RangeKey = "dockIconSize" | "dockHeight" | "dockWidth"

  type Props = {
    layout: DockLayout
    kind: "apps" | "tray" | "widgets" | "launcher"
  }

  let { layout, kind }: Props = $props()

  const device = $derived(layout.device)

  const styleOptions = $derived<{ value: DockStyle; label: string }[]>(
    (["windows", "mac"] as DockStyle[]).map(value => ({
      value,
      label: $t(`settings.dock.styles.${value}.label`),
    })),
  )

  const alignOptions = $derived<{ value: DockAlign; label: string }[]>(
    (["start", "center", "uchiwa"] as DockAlign[])
      .filter(value => !layout.mac || value !== "start")
      .map(value => ({ value, label: $t(`settings.dock.${value}`) })),
  )

  const clockOptions = $derived<{ value: ClockAlign; label: string }[]>([
    { value: "start", label: $t("settings.dock.alignStart") },
    { value: "center", label: $t("settings.dock.alignCenter") },
    { value: "end", label: $t("settings.dock.alignEnd") },
  ])

  const sideOptions = $derived<{ value: DockSide; label: string }[]>([
    { value: "left", label: $t("settings.dock.left") },
    { value: "right", label: $t("settings.dock.right") },
  ])

  const triggerOptions = $derived<{ value: LauncherTrigger; label: string }[]>(
    (["win", "shortcut", "both"] as LauncherTrigger[]).map(value => ({
      value,
      label: $t(`settings.options.${value}`),
    })),
  )
</script>

{#snippet toggleRow(key: BoolKey, label: string)}
  <label class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{label}</span>

    <input
      type="checkbox"
      class="toggle toggle-primary toggle-xs"
      checked={device[key]}
      onchange={e => layout.patch(key, e.currentTarget.checked)}
    />
  </label>
{/snippet}

{#snippet rangeRow(key: RangeKey, label: string, min: number, max: number, step: number)}
  <label class="flex flex-col gap-1 py-1 text-xs">
    <span class="flex justify-between">
      <span>{label}</span>

      <span class="text-base-content/60 tabular-nums">{device[key]}</span>
    </span>

    <input
      type="range"
      class="range range-primary range-xs"
      {min}
      {max}
      {step}
      value={device[key]}
      oninput={e => layout.preview(key, Number(e.currentTarget.value))}
      onchange={e => layout.patch(key, Number(e.currentTarget.value))}
    />
  </label>
{/snippet}

{#if kind === "apps"}
  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.style")}</span>

    <Segmented value={device.dockStyle} options={styleOptions} onchange={v => layout.patch("dockStyle", v)} />
  </div>

  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.alignment")}</span>

    <Segmented value={device.dockAlign} options={alignOptions} onchange={v => layout.patch("dockAlign", v)} />
  </div>

  {@render rangeRow("dockIconSize", $t("settings.rows.iconSize"), 16, 32, 2)}
  {@render rangeRow("dockHeight", $t("settings.rows.height"), 32, 88, 2)}

  {#if layout.mac}
    {@render rangeRow("dockWidth", $t("settings.rows.width"), 320, 1400, 20)}
    {@render toggleRow("dockDesktop", $t("settings.rows.pinDesktop"))}
  {/if}

  {@render toggleRow("showRunningApps", $t("settings.rows.showRunningApps"))}
  {@render toggleRow("dockSeparators", $t("settings.rows.dockSeparators"))}
  {@render toggleRow("dockAutoHide", $t("settings.rows.autoHide"))}
  {@render toggleRow("hideSystemTaskbar", $t("settings.rows.hideTaskbar"))}
{:else if kind === "tray"}
  {@render toggleRow("clock24h", $t("settings.rows.clock24h"))}
  {@render toggleRow("showSeconds", $t("settings.rows.showSeconds"))}

  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.clockAlign")}</span>

    <Segmented value={device.clockAlign} options={clockOptions} onchange={v => layout.patch("clockAlign", v)} />
  </div>

  <div class="my-1 border-t border-base-content/10"></div>

  {@render toggleRow("showTrayIcons", $t("settings.rows.showTrayIcons"))}
  {@render toggleRow("showBattery", $t("settings.rows.showBattery"))}
  {@render toggleRow("showVolume", $t("settings.rows.showVolume"))}
  {@render toggleRow("showNetwork", $t("settings.rows.showNetwork"))}
  {@render toggleRow("showMeters", $t("settings.rows.showMeters"))}
  {@render toggleRow("showBluetooth", $t("settings.rows.showBluetooth"))}
  {@render toggleRow("showNotifications", $t("settings.rows.showNotifications"))}
  {@render toggleRow("showInputLanguage", $t("settings.rows.showInputLanguage"))}
  {@render toggleRow("showTaskView", $t("settings.rows.showTaskView"))}
  {@render toggleRow("showDesktopButton", $t("settings.rows.showDesktopButton"))}
  {@render toggleRow("showSettingsButton", $t("settings.rows.showSettingsButton"))}
{:else if kind === "widgets"}
  {@render toggleRow("showClaudeUsage", $t("settings.rows.showClaudeUsage"))}
  {@render toggleRow("claudeUsageStacked", $t("settings.rows.claudeUsageStacked"))}

  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.claudeUsageSide")}</span>

    <Segmented value={device.claudeUsageSide} options={sideOptions} onchange={v => layout.patch("claudeUsageSide", v)} />
  </div>

  {@render toggleRow("showMedia", $t("settings.rows.showMedia"))}
  {@render toggleRow("showSpectrum", $t("settings.rows.showSpectrum"))}

  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.mediaSide")}</span>

    <Segmented value={device.mediaSide} options={sideOptions} onchange={v => layout.patch("mediaSide", v)} />
  </div>
{:else}
  {@render toggleRow("showLauncherButton", $t("settings.rows.showLauncherButton"))}

  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.openWith")}</span>

    <Segmented value={device.launcherTrigger} options={triggerOptions} onchange={v => layout.patch("launcherTrigger", v)} />
  </div>
{/if}
