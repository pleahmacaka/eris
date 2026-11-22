<script lang="ts">
import Icon from "@iconify/svelte"
import type { MockVoiceState } from "#lib/landing/mock.js"
import type { MockCopy } from "#lib/server/mock.js"
import MockAvatar from "../MockAvatar.svelte"
import MockComposer from "../MockComposer.svelte"
import MockHeader from "../MockHeader.svelte"
import MockServerLayout from "../MockServerLayout.svelte"

let { t }: { t: MockCopy } = $props()

const TILE: Record<MockVoiceState, string> = {
  idle: "border-base-content/15 bg-base-200",
  speaking: "border-success bg-success/10",
  muted: "border-base-content/15 bg-base-200",
}

const RING: Record<MockVoiceState, string> = {
  idle: "ring-transparent",
  speaking: "ring-success",
  muted: "ring-transparent",
}

const MIC: Record<MockVoiceState, { icon: string; class: string }> = {
  idle: { icon: "lucide:mic", class: "size-3.5 text-base-content/60" },
  speaking: { icon: "lucide:mic", class: "size-3.5 text-success" },
  muted: { icon: "lucide:mic-off", class: "size-3.5 text-error" },
}

const CONTROL = "btn btn-sm pointer-events-none"
</script>

<MockServerLayout {t} voice>
  <MockHeader icon="lucide:volume-2" title={t.channels.lounge} back={t.back}>
    <span class="ms-auto shrink-0 text-base-content/70">
      <Icon icon="lucide:users" class="size-4" />
    </span>
  </MockHeader>

  <div
    class={[
      "flex shrink-0 flex-col gap-3 border-b px-3 py-3 @2xl:px-4",
      "border-base-content/10",
    ]}
  >
    <div class="flex items-center gap-2">
      <Icon icon="lucide:volume-2" class="size-4 shrink-0 text-base-content/70" />
      <span class="min-w-0 truncate font-bold">{t.channels.lounge}</span>
      <span class="shrink-0 whitespace-nowrap text-xs text-base-content/70">
        {t.voice.phase}
      </span>
    </div>

    <ul class="grid grid-cols-3 gap-2 @2xl:flex @2xl:flex-wrap">
      {#each t.voice.tiles as tile (tile.name)}
        <li
          class={[
            "flex min-w-0 flex-col items-center gap-2 rounded-box border p-2",
            "text-center @2xl:w-24 @2xl:p-2.5",
            TILE[tile.state],
          ]}
        >
          <MockAvatar
            name={tile.name}
            size="lg"
            tone={tile.state === "speaking" ? "primary" : "neutral"}
            class={["ring-2 ring-offset-2 ring-offset-base-100", RING[tile.state]]}
          />
          <span class="w-full truncate text-2xs @2xl:text-xs">{tile.label}</span>
          <Icon icon={MIC[tile.state].icon} class={MIC[tile.state].class} />
        </li>
      {/each}
    </ul>

    <div class="flex flex-wrap gap-2">
      <span class={CONTROL}>
        <Icon icon="lucide:mic" class="size-4" />
        {t.voice.mute}
      </span>
      <span class={CONTROL}>
        <Icon icon="lucide:headphones" class="size-4" />
        {t.voice.deafen}
      </span>
      <span class={[CONTROL, "btn-error"]}>
        <Icon icon="lucide:phone-off" class="size-4" />
        {t.voice.leave}
      </span>
    </div>
  </div>

  <div
    class={[
      "flex min-h-0 flex-1 flex-col justify-end gap-1.5 overflow-hidden px-3 py-2",
      "text-xs text-base-content/70 @2xl:px-4",
    ]}
  >
    {#each t.voice.events as event, index (event.time)}
      <p class={["items-center gap-2", index === 0 ? "hidden @2xl:flex" : "flex"]}>
        <Icon icon="lucide:corner-down-right" class="size-3.5 shrink-0 rtl:-scale-x-100" />
        <span class="min-w-0 flex-1 truncate">{event.text}</span>
        <span class="shrink-0 whitespace-nowrap text-2xs tabular-nums">
          {event.time}
        </span>
      </p>
    {/each}
  </div>

  <MockComposer placeholder={t.placeholders.lounge} />
</MockServerLayout>
