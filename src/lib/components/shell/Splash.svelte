<script lang="ts">
import Logo from "#lib/components/brand/Logo.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
</script>

<main class="aura flex h-full items-center justify-center">
  <div class="flex flex-col items-center gap-4">
    <Logo class="size-12" />
    <span class="loading loading-spinner text-primary"></span>
    {#if i18n.ready}
      <p class="text-muted text-sm">{i18n.t("shell.splash.connecting")}</p>
    {/if}
  </div>
</main>
