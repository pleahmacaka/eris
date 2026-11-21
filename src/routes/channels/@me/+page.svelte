<script lang="ts">
import { homeViewPath } from "#lib/routes.js"
import { layoutStore } from "#lib/store/layout.svelte.js"
import { goto } from "$app/navigation"

$effect(() => {
  if (!layoutStore.narrow) {
    void goto(homeViewPath("friends"), { replaceState: true })
  }
})
</script>
