<script lang="ts">
  import type { Scope } from "$lib/data"
  import { t } from "svelte-i18n"

  const SCOPES: Scope[] = ["one", "following", "all"]

  const {
    mode,
    scoped = true,
    choose,
    cancel,
  }: {
    mode: "edit" | "delete"
    scoped?: boolean
    choose: (scope: Scope) => void
    cancel: () => void
  } = $props()
</script>

<div
  class="absolute inset-0 z-20 flex items-end bg-base-100/70 p-3 backdrop-blur-sm"
  role="presentation"
  onpointerdown={e => {
    if (e.target === e.currentTarget) {
      cancel()
    }
  }}
>
  <div
    role="dialog"
    aria-modal="true"
    aria-label={$t(`panel.scope.${mode}`)}
    class={[
      "flex w-full flex-col gap-1 rounded-box border border-base-content/10",
      "bg-base-100 p-2 shadow-2xl",
    ]}
  >
    <h3 class="px-2 pt-1 pb-1.5 text-sm font-semibold">
      {$t(scoped ? `panel.scope.${mode}` : "panel.scope.confirm")}
    </h3>

    {#if scoped}
      {#each SCOPES as scope (scope)}
        <button
          type="button"
          class={[
            "btn btn-ghost btn-sm justify-start",
            mode === "delete" && "text-error",
          ]}
          onclick={() => choose(scope)}
        >
          {$t(`panel.scope.${scope}`)}
        </button>
      {/each}
    {:else}
      <button
        type="button"
        class="btn btn-ghost btn-sm justify-start text-error"
        onclick={() => choose("one")}
      >
        {$t("common.delete")}
      </button>
    {/if}

    <button type="button" class="btn btn-sm mt-1" onclick={cancel}>
      {$t("common.cancel")}
    </button>
  </div>
</div>

