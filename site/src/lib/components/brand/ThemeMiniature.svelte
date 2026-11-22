<script lang="ts">
import Icon from "@iconify/svelte"
import MockAvatar from "#lib/components/landing/mock/MockAvatar.svelte"
import type { Copy } from "#lib/server/copy.js"

type Props = { theme: string; t: Copy["themes"]["miniature"] }

let { theme, t }: Props = $props()

const SERVER = "size-8 shrink-0"
</script>

<span
  data-theme={theme}
  class="half-scale flex bg-base-100 text-start text-base-content text-sm"
>
  <span class="flex w-12 shrink-0 flex-col items-center gap-2 bg-base-300 py-2">
    <span class={[SERVER, "rounded-selector bg-primary"]}></span>
    <span class={[SERVER, "rounded-full bg-base-content/15"]}></span>
    <span class={[SERVER, "rounded-full bg-base-content/15"]}></span>
  </span>

  <span class="flex min-w-0 flex-1 flex-col">
    <span
      class={[
        "flex h-8 shrink-0 items-center gap-2 border-b px-3 font-semibold",
        "border-base-content/10",
      ]}
    >
      <Icon icon="lucide:hash" class="size-4 shrink-0 text-base-content/60" />
      <span class="min-w-0 flex-1 truncate">{t.channel}</span>
      <span class="badge badge-primary badge-sm tabular-nums">{t.unread}</span>
    </span>

    <span
      class="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden p-2"
    >
      {#each t.rows as row (row.name)}
        <span class="flex items-center gap-2">
          <MockAvatar name={row.name} size="md" />
          <span class="flex min-w-0 flex-col leading-5">
            <span class="truncate font-semibold">{row.name}</span>
            <span class="truncate text-base-content/70">{row.text}</span>
          </span>
        </span>
      {/each}
    </span>

    <span class="flex shrink-0 items-center gap-2 px-2 pb-2">
      <span
        class={[
          "h-7 min-w-0 flex-1 rounded-field border",
          "border-base-content/25 bg-base-200",
        ]}
      ></span>
      <span class="btn btn-primary btn-sm pointer-events-none h-7">{t.send}</span>
    </span>
  </span>
</span>
