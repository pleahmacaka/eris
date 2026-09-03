<script lang="ts">
  import { goto } from "$app/navigation"
  import AccountSection from "$lib/components/settings/AccountSection.svelte"
  import AppearanceSection from "$lib/components/settings/AppearanceSection.svelte"
  import NodeSection from "$lib/components/settings/NodeSection.svelte"
  import SyncSection from "$lib/components/settings/SyncSection.svelte"
  import TopBar from "$lib/components/ui/TopBar.svelte"
  import { device } from "$lib/settings.svelte"

  const linked = $derived(device.value.sync.peers.length > 0)
</script>

<TopBar title="설정" back={() => goto("/")} showSettings={false} />

<main class="mx-auto w-full max-w-3xl min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4">
  <AccountSection />

  {#if linked}
    <NodeSection />
    <SyncSection />
  {/if}

  <AppearanceSection />
</main>
