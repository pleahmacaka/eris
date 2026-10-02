<script lang="ts">
  import Logo from "@eris/ui/Logo.svelte"
  import Icon from "@iconify/svelte"
  import type { Copy } from "$lib/copy/en"
  import MockStage from "./MockStage.svelte"

  let { t }: { t: Copy } = $props()
</script>

<MockStage>
  <div
    class={[
      "m-auto w-full max-w-2xl overflow-hidden rounded-box border",
      "border-base-content/10 bg-base-100 text-xs shadow-2xl",
    ]}
  >
    <div class="flex items-center gap-1 bg-base-200 px-2 pt-2">
      <Logo class="mx-1 mb-2 size-4" />

      {#each t.mock.terminal.tabs as tab, i (tab)}
        <span
          class={[
            "flex items-center gap-2 rounded-t-xl px-3 py-1.5",
            i === 0 ? "bg-base-100" : "text-base-content/60",
          ]}
        >
          <Icon icon="lucide:terminal" class="size-3.5 text-primary" />
          {tab}
          <Icon icon="lucide:x" class="size-3 text-base-content/40" />
        </span>
      {/each}

      <Icon icon="lucide:plus" class="ml-1 size-3.5 text-base-content/50" />
      <Icon icon="lucide:chevron-down" class="size-3.5 text-base-content/50" />

      <span class="ml-auto flex gap-3 px-2 pb-2 text-base-content/50">
        <Icon icon="lucide:minus" class="size-3.5" />
        <Icon icon="lucide:square" class="size-3" />
        <Icon icon="lucide:x" class="size-3.5" />
      </span>
    </div>

    <div class="flex min-h-56 flex-col gap-1 p-4 text-sm tabular-nums">
      <span>
        <span class="text-base-content/60">{t.mock.terminal.prompt}</span>
        <span class="text-primary">{t.mock.terminal.command}</span>
      </span>

      {#each t.mock.terminal.output as line (line)}
        <span class="text-base-content/70">{line}</span>
      {/each}

      <span class="flex items-center gap-1">
        <span class="text-base-content/60">{t.mock.terminal.prompt}</span>
        <span class="h-4 w-2 animate-pulse bg-primary"></span>
      </span>
    </div>
  </div>
</MockStage>
