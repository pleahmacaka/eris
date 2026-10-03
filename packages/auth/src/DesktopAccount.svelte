<script lang="ts">
  import AccountPanel from "./AccountPanel.svelte"
  import { desktopAccount } from "./tauri"

  let { lang }: { lang?: string | null } = $props()
</script>

{#await desktopAccount()}
  <AccountPanel account={null} {lang} />
{:then account}
  <AccountPanel {account} {lang} />
{/await}
