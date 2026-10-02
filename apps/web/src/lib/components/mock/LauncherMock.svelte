<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Copy } from "$lib/copy/en"
  import MockStage from "./MockStage.svelte"

  let { t }: { t: Copy } = $props()

  const icons = ["lucide:calculator", "lucide:clipboard", "lucide:globe"]
</script>

<MockStage>
  <div
    class={[
      "m-auto w-full max-w-md overflow-hidden rounded-2xl border",
      "border-base-content/10 bg-base-100 shadow-2xl",
    ]}
  >
    <div
      class="flex items-center gap-3 border-b border-base-content/10 px-4 py-3.5"
    >
      <Icon icon="lucide:search" class="size-5 text-base-content/50" />

      <span class="flex items-center text-lg tabular-nums">
        {t.mock.launcher.query}
        <span class="ml-0.5 h-5 w-0.5 animate-blink bg-primary"></span>
      </span>

      <kbd class="kbd kbd-sm ml-auto">Win</kbd>
    </div>

    <div class="flex flex-col p-2">
      {#each t.mock.launcher.results as result, i (result.hint)}
        <div
          class={[
            "flex items-center gap-3 rounded-xl px-3 py-2.5",
            i === 0 && "bg-primary/15",
          ]}
        >
          <span
            class="grid size-8 shrink-0 place-items-center rounded-lg bg-base-200"
          >
            <Icon icon={icons[i]} class="size-4" />
          </span>

          <span
            class={[
              "truncate",
              i === 0 && "font-semibold text-xl tabular-nums",
            ]}
          >
            {result.title}
          </span>

          <span class="ml-auto shrink-0 text-base-content/50 text-xs">
            {result.hint}
          </span>
        </div>
      {/each}
    </div>
  </div>
</MockStage>
