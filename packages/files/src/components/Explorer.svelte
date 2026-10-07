<script lang="ts">
  import { HOME } from "../locations"
  import { explorerSettings, type Intent, takeIntent } from "../native"
  import { Explorer } from "../store/explorer.svelte"
  import { refreshPlaces } from "../store/places.svelte"
  import { firstRun, prefs } from "../store/prefs.svelte"
  import ExplorerWindow from "./ExplorerWindow.svelte"

  let { standalone = false }: { standalone?: boolean } = $props()

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
    .then(intent => {
      const explorer = new Explorer(intent.path ?? HOME, intent.select)

      explorer.setupOpen = standalone && !prefs.setupDone

      return explorer
    })
</script>

{#await ready then explorer}
  <ExplorerWindow {explorer} {standalone} />
{/await}
