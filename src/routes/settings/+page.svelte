<script lang="ts">
  import { goto } from "$app/navigation"
  import AppearanceSection from "$lib/components/settings/AppearanceSection.svelte"
  import SyncSection from "$lib/components/settings/SyncSection.svelte"
  import TopBar from "$lib/components/ui/TopBar.svelte"
</script>

<TopBar title="설정" back={() => goto("/")} showSettings={false} />

<main class="mx-auto w-full max-w-3xl min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4">
  <SyncSection />

  <AppearanceSection />
</main>
