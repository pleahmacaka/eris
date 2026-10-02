<script lang="ts">
  import type { Snippet } from "svelte"
  import { HOME } from "../locations"
  import { explorerSettings, type Intent, takeIntent } from "../native"
  import { Explorer } from "../store/explorer.svelte"
  import { refreshPlaces } from "../store/places.svelte"
  import { firstRun, prefs } from "../store/prefs.svelte"
  import ExplorerWindow from "./ExplorerWindow.svelte"

  let { theme }: { theme?: Snippet } = $props()

  if (firstRun()) {
    explorerSettings()
      .then(settings => {
        prefs.showHidden = settings.showHidden
        prefs.showExtensions = settings.showExtensions
      })
      .catch(() => undefined)
  }

  refreshPlaces()

  const ready = takeIntent()
    .catch((): Intent => ({ path: null, select: null }))
    .then(intent => new Explorer(intent.path ?? HOME, intent.select))
</script>

{#await ready then explorer}
  <ExplorerWindow {explorer} {theme} />
{/await}
