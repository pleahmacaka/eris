<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Copy } from "$lib/copy/en"
  import MockStage from "./MockStage.svelte"

  let { t }: { t: Copy } = $props()

  const usage = $derived([
    { label: t.mock.claude.fiveHour, percent: 42 },
    { label: t.mock.claude.weekly, percent: 18 },
  ])
</script>

<MockStage>
  <div class="m-auto flex w-full max-w-md flex-col gap-3">
    <div
      class={[
        "overflow-hidden rounded-2xl border border-base-content/10",
        "bg-base-100 text-sm shadow-2xl",
      ]}
    >
      <div
        class={[
          "flex items-center gap-2 border-b border-base-content/10",
          "px-4 py-2.5",
        ]}
      >
        <Icon icon="lucide:sparkles" class="size-4 text-primary" />
        <span class="font-semibold">Claude</span>

        <span class="ml-auto flex gap-1">
          <span class="size-1.5 rounded-full bg-primary"></span>
          <span class="size-1.5 rounded-full bg-base-content/30"></span>
        </span>
      </div>

      <div class="flex flex-col gap-3 p-4">
        <span
          class={[
            "ml-auto max-w-xs rounded-2xl bg-primary px-3 py-2",
            "text-primary-content",
          ]}
        >
          {t.mock.claude.ask}
        </span>

        <span class="flex max-w-xs gap-2">
          <Icon
            icon="lucide:folder-tree"
            class="mt-0.5 size-4 shrink-0 text-base-content/50"
          />
          {t.mock.claude.reply}
        </span>
      </div>

      <div
        class={[
          "flex items-center gap-2 border-t border-base-content/10 px-4 py-2.5",
          "text-base-content/40",
        ]}
      >
        <span class="h-4 w-0.5 animate-blink bg-primary"></span>

        <span
          class="ml-auto grid size-6 place-items-center rounded-full bg-primary/15"
        >
          <Icon icon="lucide:arrow-up" class="size-3.5 text-primary" />
        </span>
      </div>
    </div>

    <div
      class={[
        "flex items-center gap-5 self-end rounded-2xl border px-4 py-3",
        "border-base-content/10 bg-base-100 text-xs shadow-2xl",
      ]}
    >
      {#each usage as meter (meter.label)}
        <div class="flex w-24 flex-col gap-1.5">
          <span class="flex justify-between tabular-nums">
            <span class="text-base-content/60">{meter.label}</span>
            {meter.percent}%
          </span>

          <progress
            class="progress progress-primary h-1"
            value={meter.percent}
            max="100"
          ></progress>
        </div>
      {/each}
    </div>
  </div>
</MockStage>
