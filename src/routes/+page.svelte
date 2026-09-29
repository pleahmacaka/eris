<script lang="ts">
  import AppShell from "$lib/components/shell/AppShell.svelte"
  import { isTauri } from "$lib/platform/runtime"
</script>

{#if isTauri()}
  <AppShell />
{:else}
  <main class="flex h-dvh items-center justify-center bg-base-200 p-6">
    <div
      class={[
        "flex max-w-sm flex-col items-center gap-2 border border-dashed",
        "border-base-content/15 px-6 py-10 text-center",
      ]}
    >
      <p class="font-medium">브라우저 미지원</p>
      <p class="text-sm text-base-content/50">
        Windows 또는 Android 앱에서 실행하세요.
      </p>
    </div>
  </main>
{/if}
