<script lang="ts">
  import { untrack } from "svelte"
  import { SHARED } from "../../locations"
  import type { Explorer } from "../../store/explorer.svelte"
  import ShareDialog from "./ShareDialog.svelte"
  import { share, startShare } from "./share.svelte"

  let { explorer }: { explorer: Explorer } = $props()

  $effect(() => startShare())

  $effect(() => {
    if (share.center) {
      untrack(() => {
        share.center = false
        explorer.go(SHARED)
      })
    }
  })
</script>

<ShareDialog />
