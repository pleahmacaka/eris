<script lang="ts">
  import "virtual:iconify-subset"
  import { logoSvg } from "@eris/ui/logo"
  import "./layout.css"

  let { children } = $props()

  const favicon = `data:image/svg+xml,${encodeURIComponent(logoSvg())}`

</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href={favicon} />
</svelte:head>

{@render children()}
