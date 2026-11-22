<script lang="ts">
import Icon from "@iconify/svelte"
import type { Snippet } from "svelte"
import type { MockCopy } from "#lib/server/mock.js"
import { useMockDemo } from "#lib/store/mockDemo.svelte.js"
import MockAvatar from "./MockAvatar.svelte"
import MockLabel from "./MockLabel.svelte"
import MockMembers from "./MockMembers.svelte"
import MockRail from "./MockRail.svelte"
import MockRow from "./MockRow.svelte"
import MockSidebar from "./MockSidebar.svelte"

type Props = { t: MockCopy; voice?: boolean; children: Snippet }

let { t, voice = false, children }: Props = $props()

const demo = useMockDemo()

const channel = $derived(demo?.channel ?? "general")
</script>

{#snippet connection()}
  <div
    class={[
      "flex shrink-0 items-center gap-1.5 border-t px-2 py-1.5",
      "border-base-content/10",
    ]}
  >
    <Icon icon="lucide:radio" class="size-4 shrink-0 text-success" />

    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate font-semibold text-success text-xs">
        {t.voice.status}
      </span>
      <span class="truncate text-2xs text-base-content/60">
        {t.channels.lounge}
      </span>
    </span>

    <Icon icon="lucide:phone-off" class="size-3.5 shrink-0 text-base-content/60" />
  </div>
{/snippet}

<MockRail {t} />

<MockSidebar {t} title={t.server} footer={voice ? connection : undefined}>
  <MockLabel label={t.nav.text} />
  <MockRow
    icon="lucide:hash"
    label={t.channels.general}
    active={!voice && channel === "general"}
    onclick={demo && (() => demo.openChannel("general"))}
  />
  <MockRow
    icon="lucide:hash"
    label={t.channels.dev}
    active={!voice && channel === "dev"}
    onclick={demo && (() => demo.openChannel("dev"))}
  />

  <MockLabel label={t.nav.voice} />
  <MockRow
    icon="lucide:volume-2"
    label={t.channels.lounge}
    active={voice}
    onclick={demo && (() => demo.openVoice())}
  />

  {#if voice}
    <ul class="ms-6 flex flex-col gap-1.5 py-1.5">
      {#each t.voice.tiles as tile (tile.name)}
        <li class="flex items-center gap-2 px-2 text-xs text-base-content/70">
          <MockAvatar
            name={tile.name}
            size="xs"
            class={[
              "ring-2 ring-offset-1 ring-offset-base-200",
              tile.state === "speaking" ? "ring-success" : "ring-transparent",
            ]}
          />
          <span class="min-w-0 truncate">{tile.name}</span>
        </li>
      {/each}
    </ul>
  {/if}
</MockSidebar>

<div
  class={[
    "min-w-0 flex-1 flex-col",
    demo?.listOpen ? "hidden @2xl:flex" : "flex",
  ]}
>
  {@render children()}
</div>

<MockMembers {t} />
