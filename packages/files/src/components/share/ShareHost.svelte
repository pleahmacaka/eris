<script lang="ts">
  import { untrack } from "svelte"
  import type { Explorer } from "../../store/explorer.svelte"
  import BrowseAsks from "./BrowseAsks.svelte"
  import { share, startShare } from "./share.svelte"

  let { explorer }: { explorer: Explorer } = $props()

  $effect(() => startShare())

  $effect(() => {
    if (share.center) {
      untrack(() => {
        share.center = false

        if (share.state.pendingPair) {
          explorer.settingsOpen = true
        }
      })
    }
  })
</script>

{#if share.state.browseAsks.length > 0}
  <div class="fixed right-4 bottom-12 z-50 flex w-80 flex-col gap-2 rounded-box bg-base-100 shadow-lg">
    <BrowseAsks />
  </div>
{/if}
