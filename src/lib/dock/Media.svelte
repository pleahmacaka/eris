<script lang="ts">
  import Icon from "@iconify/svelte"
  import {
    type MediaAction,
    mediaCommand,
    type MediaStatus,
    mediaStatus,
  } from "$lib/native"

  type Props = { compact?: boolean }

  let { compact = false }: Props = $props()

  const POLL = 3_000
  const SETTLE = 1_000

  let status = $state<MediaStatus | null>(null)
  let failed = $state(false)
  let generation = 0
  let settleUntil = 0

  const refresh = async () => {
    const at = generation
    const next = await mediaStatus().catch(() => null)

    if (at === generation && Date.now() >= settleUntil) {
      status = next
      failed = false
    }
  }

  $effect(() => {
    refresh()

    const timer = setInterval(refresh, POLL)

    return () => clearInterval(timer)
  })

  const send = async (action: MediaAction) => {
    const previous = $state.snapshot(status)

    generation += 1

    if (status && action === "playpause") {
      status.playing = !status.playing
      settleUntil = Date.now() + SETTLE
    }

    const sent = await mediaCommand(action)
      .then(() => true)
      .catch(() => false)

    failed = !sent

    if (!sent) {
      settleUntil = 0
      status = previous

      return
    }

    // SMTC acks delivery, not playback, so a read here still returns the old status
    if (action !== "playpause") {
      await refresh()
    }
  }

  const label = $derived.by(() => {
    if (!status) {
      return ""
    }

    return [status.title, status.artist, status.app]
      .filter(Boolean)
      .join(" · ")
  })
</script>

{#if status}
  <div class="group flex items-center gap-0.5" role="group" aria-label="Media">
    <button
      class="btn btn-ghost btn-square btn-sm invisible group-hover:visible"
      title="Previous"
      aria-label="Previous track"
      onclick={() => send("previous")}
    >
      <Icon icon="lucide:skip-back" class="size-3.5" />
    </button>

    <button
      class={["btn btn-ghost btn-square btn-sm", failed && "text-error"]}
      title={failed ? "Media command failed" : label}
      aria-label={status.playing ? "Pause" : "Play"}
      onclick={() => send("playpause")}
    >
      <Icon
        icon={status.playing ? "lucide:pause" : "lucide:play"}
        class="size-4"
      />
    </button>

    <button
      class="btn btn-ghost btn-square btn-sm invisible group-hover:visible"
      title="Next"
      aria-label="Next track"
      onclick={() => send("next")}
    >
      <Icon icon="lucide:skip-forward" class="size-3.5" />
    </button>

    {#if !compact && status.title}
      <span
        class="max-w-28 truncate text-xs text-base-content/70"
        title={label}
      >
        {status.title}
      </span>
    {/if}
  </div>
{/if}
