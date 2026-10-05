<script lang="ts">
  import type { PanelId } from "$lib/workspace/layout.svelte"
  import BacklinksPanel from "./BacklinksPanel.svelte"
  import Explorer from "./Explorer.svelte"
  import OutlinePanel from "./OutlinePanel.svelte"
  import SearchPanel from "./SearchPanel.svelte"

  const { panel }: { panel: PanelId } = $props()
</script>

{#if panel === "files"}
  <Explorer />
{:else if panel === "search"}
  <SearchPanel />
{:else if panel === "backlinks"}
  <BacklinksPanel />
{:else}
  <OutlinePanel />
{/if}
