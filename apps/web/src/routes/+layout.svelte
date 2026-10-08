<script lang="ts">
  import icons from "virtual:iconify-subset"
  import { logoSvg } from "@eris/ui/logo"
  import { addCollection } from "@iconify/svelte"
  import "./layout.css"

  let { children } = $props()

  const favicon = `data:image/svg+xml,${encodeURIComponent(logoSvg())}`

  for (const collection of icons) {
    addCollection(collection)
  }
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href={favicon} />
</svelte:head>

{@render children()}
