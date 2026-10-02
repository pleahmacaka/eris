<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { dateKey } from "$lib/data"
  import type { Panel } from "./panel.svelte"

  const {
    panel,
    collapse,
    hide,
  }: { panel: Panel; collapse: () => void; hide: () => void } = $props()

  const kind = $derived(panel.view.kind)
</script>

<header class="flex min-h-14 items-center justify-between gap-3 px-4 pt-3 pb-1">
  <div class="min-w-0">
    <h1 class="truncate text-base font-semibold tracking-tight tabular-nums">
      {panel.monthLabel}
    </h1>
    <p class="text-2xs tabular-nums text-base-content/55">
      {$t("panel.header.today", { values: { date: dateKey(panel.today) } })}
    </p>
  </div>

  <div class="flex shrink-0 items-center gap-2">
    {#if panel.concealedCount > 0}
      <span
        class="badge badge-sm badge-soft badge-warning gap-1"
        title={$t("panel.sharingHint")}
      >
        <Icon icon="lucide:eye-off" class="size-3" />
        {$t("panel.sharing")}
      </span>
    {/if}

    <div class="join">
      <button
        class="join-item btn btn-xs btn-ghost btn-square"
        aria-label={$t("common.previous")}
        onclick={() => panel.shift(-1)}
      >
        <Icon icon="lucide:chevron-left" class="size-3.5" />
      </button>

      <button class="join-item btn btn-xs btn-ghost" onclick={panel.jumpToday}>
        {$t("dates.today")}
      </button>

      <button
        class="join-item btn btn-xs btn-ghost btn-square"
        aria-label={$t("common.next")}
        onclick={() => panel.shift(1)}
      >
        <Icon icon="lucide:chevron-right" class="size-3.5" />
      </button>
    </div>

    <div class="flex items-center gap-1">
      <button class="btn btn-xs btn-neutral" onclick={panel.startNew}>
        <Icon icon="lucide:plus" class="size-3.5" />
        {$t("panel.event.new")}
      </button>

      <button
        class={["btn btn-xs btn-ghost", kind === "todo" && "btn-active"]}
        aria-pressed={kind === "todo"}
        onclick={panel.showTodos}
      >
        <Icon icon="lucide:list-checks" class="size-3.5" />
        {$t("panel.todos")}
      </button>

      <button
        class={["btn btn-xs btn-ghost", kind === "notes" && "btn-active"]}
        aria-pressed={kind === "notes"}
        onclick={panel.showNotes}
      >
        <Icon icon="lucide:sticky-note" class="size-3.5" />
        {$t("panel.notesAria")}
      </button>

      <button
        class="btn btn-ghost btn-square btn-xs"
        aria-label={$t("panel.collapse")}
        onclick={collapse}
      >
        <Icon icon="lucide:minimize-2" class="size-3.5" />
      </button>

      <button
        class="btn btn-ghost btn-square btn-xs"
        aria-label={$t("common.close")}
        onclick={hide}
      >
        <Icon icon="lucide:x" class="size-3.5" />
      </button>
    </div>
  </div>
</header>
