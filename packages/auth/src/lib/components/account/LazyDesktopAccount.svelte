<script lang="ts">
  let { lang }: { lang?: string | null } = $props()
</script>

{#await import("../../../tauri") then { DesktopAccount }}
  <DesktopAccount {lang} />
{/await}
