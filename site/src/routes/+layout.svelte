<script lang="ts">
import type { Snippet } from "svelte"
import { asset, resolve } from "$app/paths"

let { children }: { children: Snippet } = $props()
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href={resolve("/favicon.svg")} />
  <link rel="icon" sizes="32x32" href={asset("favicon.ico")} />
  <link rel="apple-touch-icon" href={asset("apple-touch-icon.png")} />
</svelte:head>

{@render children()}
