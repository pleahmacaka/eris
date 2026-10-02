<script lang="ts">
  import { logoSvg } from "@eris/ui/logo"
  import { addCollection } from "@iconify/svelte"
  import { lucideSubset } from "$lib/icons"
  import "./layout.css"

  let { children } = $props()

  const favicon = `data:image/svg+xml,${encodeURIComponent(logoSvg())}`

  addCollection(lucideSubset)
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href={favicon} />
</svelte:head>

{@render children()}
