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
  class="absolute inset-0 z-20 flex items-center justify-center rounded-box bg-black/45 p-4 backdrop-blur-[2px]"
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
      "flex w-full max-w-72 flex-col gap-1.5 rounded-box border border-base-content/15",
      "bg-base-200 p-3 shadow-2xl",
    ]}
  >
    <h3 class="px-1 pb-1.5 text-sm font-semibold">
      {$t(scoped ? `panel.scope.${mode}` : "panel.scope.confirm")}
    </h3>

    {#if scoped}
      {#each SCOPES as scope (scope)}
        <button
          type="button"
          class={[
            "btn btn-sm btn-block justify-start border-base-content/10 bg-base-content/5",
            mode === "delete" && "text-error hover:bg-error/15",
          ]}
          onclick={() => choose(scope)}
        >
          {$t(`panel.scope.${scope}`)}
        </button>
      {/each}
    {:else}
      <button
        type="button"
        class="btn btn-error btn-sm btn-block"
        onclick={() => choose("one")}
      >
        {$t("common.delete")}
      </button>
    {/if}

    <button type="button" class="btn btn-ghost btn-sm btn-block" onclick={cancel}>
      {$t("common.cancel")}
    </button>
  </div>
</div>

