<script lang="ts">
  import { t } from "svelte-i18n"
  import { EditSpot } from "$lib/edit"
  import ClaudeUsage from "./ClaudeUsage.svelte"
  import EditOptions from "./EditOptions.svelte"
  import type { DockLayout } from "./layout.svelte"
  import Media from "./Media.svelte"

  let {
    layout,
    edge,
    compact,
  }: { layout: DockLayout; edge?: "top" | "bottom"; compact?: boolean } = $props()

  const device = $derived(layout.device)

  const widgetEdge = $derived(edge ?? device.dockEdge)

  const widgetCompact = $derived(compact ?? device.dockHeight < 40)

  const spotClaim = $derived(layout.claimFor("spot-widgets"))
  const mediaClaim = $derived(layout.claimFor("media"))

  const leftWidgets = $derived(
    (device.features.chat &&
      device.showClaudeUsage &&
      device.claudeUsageSide === "left") ||
      (device.showMedia && device.mediaSide === "left"),
  )
</script>

{#if leftWidgets}
  <EditSpot id="widgets" label={$t("edit.spots.widgets")} placement={layout.spotPlacement} align="start" onmenu={spotClaim}>
    {#snippet options()}
      <EditOptions {layout} kind="widgets" />
    {/snippet}

    {#if device.features.chat && device.showClaudeUsage && device.claudeUsageSide === "left"}
      <ClaudeUsage
        source={device.claudeUsageSource}
        compact={widgetCompact}
        stacked={device.claudeUsageStacked}
      />
    {/if}

    {#if device.showMedia && device.mediaSide === "left"}
      <Media
        compact={widgetCompact}
        edge={widgetEdge}
        spectrum={device.showSpectrum}
        spectrumStyle={device.spectrumStyle}
        onmenu={mediaClaim}
      />
    {/if}
  </EditSpot>
{/if}
