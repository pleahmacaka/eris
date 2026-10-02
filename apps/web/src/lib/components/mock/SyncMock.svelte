<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Copy } from "$lib/copy/en"
  import MockStage from "./MockStage.svelte"

  let { t }: { t: Copy } = $props()

  const icons = ["lucide:monitor", "lucide:laptop"]
</script>

<MockStage>
  <div class="m-auto flex w-full max-w-lg flex-col items-center gap-10">
    <div class="flex w-full items-center">
      {#each t.mock.sync.devices as device, i (device)}
        {#if i > 0}
          <div class="relative flex-1 border-t border-dashed border-primary/60">
            <span
              class={[
                "absolute top-1/2 left-1/2 size-2 -translate-1/2 rounded-full",
                "bg-primary",
              ]}
            ></span>
          </div>
        {/if}

        <div
          class={[
            "flex flex-col items-center gap-2 rounded-2xl border",
            "border-base-content/10 bg-base-100 px-5 py-4 shadow-2xl",
          ]}
        >
          <Icon icon={icons[i]} class="size-8 text-base-content/80" />
          <span class="text-sm">{device}</span>
        </div>
      {/each}
    </div>

    <div class="flex flex-wrap justify-center gap-2">
      {#each t.mock.sync.collections as collection (collection)}
        <span
          class={[
            "rounded-full border border-base-content/10 bg-base-100",
            "px-3 py-1 text-xs",
          ]}
        >
          {collection}
        </span>
      {/each}
    </div>
  </div>
</MockStage>
