<script lang="ts">
  import { t } from "svelte-i18n"
  import { EditSpot } from "$lib/edit"
  import ClaudeUsage from "./ClaudeUsage.svelte"
  import EditOptions from "./EditOptions.svelte"
  import type { DockLayout } from "./layout.svelte"
  import Media from "./Media.svelte"

  let { layout }: { layout: DockLayout } = $props()

  const device = $derived(layout.device)

  const leftWidgets = $derived(
    (device.showClaudeUsage && device.claudeUsageSide === "left") ||
      (device.showMedia && device.mediaSide === "left"),
  )
</script>

{#if leftWidgets}
  <EditSpot id="widgets" label={$t("edit.spots.widgets")} placement={layout.spotPlacement} align="start" onmenu={layout.extend}>
    {#snippet options()}
      <EditOptions {layout} kind="widgets" />
    {/snippet}

    {#if device.showClaudeUsage && device.claudeUsageSide === "left"}
      <ClaudeUsage
        source={device.claudeUsageSource}
        compact={device.dockHeight < 40}
        stacked={device.claudeUsageStacked}
      />
    {/if}

    {#if device.showMedia && device.mediaSide === "left"}
      <Media
        compact={device.dockHeight < 40}
        edge={device.dockEdge}
        spectrum={device.showSpectrum}
        spectrumStyle={device.spectrumStyle}
        onmenu={layout.extend}
      />
    {/if}
  </EditSpot>
{/if}
