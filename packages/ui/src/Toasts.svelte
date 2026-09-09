<script lang="ts">
  import Icon from "@iconify/svelte"
  import { toasts } from "./toast.svelte"

  const icons = {
    success: "lucide:check",
    error: "lucide:alert-circle",
    info: "lucide:info",
  }
</script>

{#if toasts.length}
  <div class="toast toast-end toast-bottom z-50">
    {#each toasts as t (t.id)}
      <div
        class={[
          "alert alert-soft border border-base-content/10 shadow-lg backdrop-blur-md",
          t.kind === "success" && "alert-success",
          t.kind === "error" && "alert-error",
        ]}
      >
        <Icon icon={icons[t.kind]} class="size-4" />

        <span class="text-sm">{t.text}</span>
      </div>
    {/each}
  </div>
{/if}
