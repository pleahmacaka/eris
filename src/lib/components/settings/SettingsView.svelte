<script lang="ts">
  import AppearanceSection from "./AppearanceSection.svelte"
  import LayoutSection from "./LayoutSection.svelte"
  import SyncSection from "./SyncSection.svelte"
  import VaultSection from "./VaultSection.svelte"
</script>

<div class="min-h-0 flex-1 overflow-y-auto bg-base-100">
  <div class="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
    <h1 class="mb-6 text-2xl font-bold tracking-tight">설정</h1>

    <VaultSection />
    <SyncSection />
    <AppearanceSection />
    <LayoutSection />
  </div>
</div>
