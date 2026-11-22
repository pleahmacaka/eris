<script lang="ts">
import Icon from "@iconify/svelte"
import type { MockResultKind } from "#lib/landing/mock.js"
import type { MockCopy } from "#lib/server/mock.js"
import { useMockDemo } from "#lib/store/mockDemo.svelte.js"
import MockAvatar from "../MockAvatar.svelte"
import MockDialog from "../MockDialog.svelte"
import ChatScreen from "./ChatScreen.svelte"

type Result = MockCopy["switcher"]["results"][number]

let { t }: { t: MockCopy } = $props()

const demo = useMockDemo()

const HINT = "flex items-center gap-1.5 whitespace-nowrap"

const RESULT = "flex w-full items-center gap-3 rounded-field px-2 py-1.5"

const LIVE = "cursor-pointer text-start hover:bg-base-content/10"

const open = (kind: MockResultKind, name: string) => {
  if (kind === "voice") {
    demo?.openVoice()
  } else if (kind === "dm") {
    demo?.openDm(name)
  } else {
    demo?.openChannel("general")
  }
}
</script>

{#snippet row(result: Result)}
  {#if result.kind === "text" || result.kind === "voice"}
    <span class="flex size-5 shrink-0 items-center justify-center">
      <Icon
        icon={result.kind === "voice" ? "lucide:volume-2" : "lucide:hash"}
        class="size-4"
      />
    </span>
  {:else}
    <MockAvatar
      name={result.name}
      size="xs"
      tone={result.kind === "dm" ? "primary" : "neutral"}
    />
  {/if}

  <span class="min-w-0 flex-1 truncate">{result.name}</span>
  <span class="max-w-2/5 shrink-0 truncate text-2xs text-base-content/60">
    {result.detail}
  </span>
{/snippet}

<ChatScreen {t} />

<MockDialog title={t.switcher.title} close={t.close} class="max-w-md">
  {#snippet aside()}
    <span class="flex shrink-0 gap-1" dir="ltr">
      {#each t.switcher.keys as key (key)}
        <kbd class="kbd kbd-sm">{key}</kbd>
      {/each}
    </span>
  {/snippet}

  <span
    class={[
      "flex h-9 shrink-0 items-center gap-2 rounded-field border px-3",
      "border-primary bg-base-200",
    ]}
  >
    <Icon icon="lucide:search" class="size-4 shrink-0 text-base-content/60" />
    <span class="min-w-0 truncate text-base-content/60">
      {t.switcher.placeholder}
    </span>
  </span>

  <div class="flex min-h-0 flex-col gap-0.5 overflow-hidden">
    {#each t.switcher.results as result, index (result.kind)}
      {@const tone = index === 0 ? "bg-base-content/10" : "text-base-content/70"}

      {#if demo}
        <button
          type="button"
          class={[RESULT, tone, LIVE]}
          onclick={() => open(result.kind, result.name)}
        >
          {@render row(result)}
        </button>
      {:else}
        <span class={[RESULT, tone]}>
          {@render row(result)}
        </span>
      {/if}
    {/each}
  </div>

  <div
    class={[
      "flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3",
      "border-base-content/10 text-2xs text-base-content/70",
    ]}
  >
    <ul class="hidden flex-wrap items-center gap-x-3 gap-y-1 @lg:flex">
      {#each t.switcher.filters as filter (filter.key)}
        <li class={HINT}>
          <kbd class="kbd kbd-xs">{filter.key}</kbd>
          {filter.label}
        </li>
      {/each}
    </ul>

    <ul class="ms-auto flex shrink-0 items-center gap-3">
      <li class={HINT}>
        <kbd class="kbd kbd-xs"><Icon icon="lucide:arrow-up" class="size-3" /></kbd>
        <kbd class="kbd kbd-xs"><Icon icon="lucide:arrow-down" class="size-3" /></kbd>
        {t.switcher.move}
      </li>
      <li class={HINT}>
        <kbd class="kbd kbd-xs">{t.switcher.enter}</kbd>
        {t.switcher.open}
      </li>
    </ul>
  </div>
</MockDialog>
