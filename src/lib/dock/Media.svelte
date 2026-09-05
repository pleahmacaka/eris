<script lang="ts">
  import Icon from "@iconify/svelte"
  import * as native from "$lib/native"
  import {
    type MediaAction,
    mediaCommand,
    type MediaStatus,
    mediaStatus,
  } from "$lib/native"
  import type { DockEdge, SpectrumStyle } from "$lib/settings"
  import Spectrum from "./Spectrum.svelte"

  type Props = {
    compact?: boolean
    edge?: DockEdge
    spectrum?: boolean
    spectrumStyle?: SpectrumStyle
    onmenu?: (height: number) => void
  }

  let {
    compact = false,
    edge = "bottom",
    spectrum = true,
    spectrumStyle = "bars",
    onmenu,
  }: Props = $props()

  const POLL = 3_000
  const SETTLE = 1_000
  const POPOVER_GAP = 16
  const STEP = 0.05

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

  let open = $state(false)
  let popover = $state<HTMLElement>()
  let volume = $state<native.Volume | null>(null)

  const readVolume = async () => {
    volume = await native
      .systemInfo()
      .then(info => info.volume)
      .catch(() => null)
  }

  const setOpen = (next: boolean) => {
    if (open === next) {
      return
    }

    open = next

    if (next) {
      readVolume()
    } else {
      onmenu?.(0)
    }
  }

  $effect(() => {
    if (open && popover) {
      onmenu?.(popover.offsetHeight + POPOVER_GAP)
    }
  })

  const setLevel = async (next: number) => {
    const clamped = Math.min(1, Math.max(0, Math.round(next * 100) / 100))

    volume = { level: clamped, muted: false }
    await native.setVolume(clamped).catch(() => undefined)
  }

  const onwheel = (e: WheelEvent) => {
    if (!volume) {
      readVolume()

      return
    }

    e.preventDefault()
    setLevel(volume.level + (e.deltaY < 0 ? STEP : -STEP))
  }

  const onmousedown = (e: MouseEvent) => {
    if (open && !(e.target as Element).closest("[data-media]")) {
      setOpen(false)
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (open && e.key === "Escape") {
      setOpen(false)
    }
  }

  const label = $derived.by(() => {
    if (!status) {
      return ""
    }

    return [status.title, status.artist, status.app].filter(Boolean).join(" · ")
  })

  const subtitle = $derived(
    status ? [status.artist, status.app].filter(Boolean).join(" · ") : "",
  )
</script>

<svelte:window {onmousedown} {onkeydown} />

{#if status}
  <div class="relative" data-media>
    <div
      class={[
        "flex items-center gap-0.5 rounded-field border border-base-content/10 px-0.5 transition-colors duration-150",
        open ? "bg-base-content/10" : "bg-base-content/5 hover:bg-base-content/10",
      ]}
      role="group"
      aria-label="Media"
    >
      <button
        class="btn btn-ghost btn-square btn-xs"
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
        class="btn btn-ghost btn-square btn-xs"
        title="Next"
        aria-label="Next track"
        onclick={() => send("next")}
      >
        <Icon icon="lucide:skip-forward" class="size-3.5" />
      </button>

      {#if spectrum && status.playing}
        <button
          class="flex items-center gap-1.5 rounded-field px-1.5 py-1"
          title={label}
          aria-label="Now playing"
          aria-haspopup="dialog"
          aria-expanded={open}
          onclick={() => setOpen(!open)}
          {onwheel}
        >
          <Spectrum style={spectrumStyle} bars={12} height={14} />

          {#if !compact && status.title}
            <span class="max-w-24 truncate text-xs text-base-content/70">
              {status.title}
            </span>
          {/if}
        </button>
      {:else if !compact && status.title}
        <button
          class="max-w-28 truncate rounded-field px-1.5 py-1 text-xs text-base-content/70"
          title={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onclick={() => setOpen(!open)}
          {onwheel}
        >
          {status.title}
        </button>
      {:else}
        <button
          class="btn btn-ghost btn-square btn-xs"
          title={label}
          aria-label="Now playing"
          aria-haspopup="dialog"
          aria-expanded={open}
          onclick={() => setOpen(!open)}
          {onwheel}
        >
          <Icon icon="lucide:chevron-up" class="size-3.5" />
        </button>
      {/if}
    </div>

    {#if open}
      <div
        bind:this={popover}
        class={[
          "absolute left-0 z-50 w-80 rounded-box border border-base-content/10 bg-base-100/90 p-3 shadow-xl backdrop-blur-xl",
          edge === "top" ? "top-full mt-2" : "bottom-full mb-2",
        ]}
        role="dialog"
        aria-label="Now playing"
      >
        <p class="truncate text-sm font-medium">
          {status.title || "재생 없음"}
        </p>

        <p class="mt-0.5 truncate text-xs text-base-content/55">
          {subtitle || "정보 없음"}
        </p>

        {#if spectrum}
          <div class="mt-3 flex justify-center rounded-field bg-base-content/5 p-2">
            <Spectrum style={spectrumStyle} bars={28} height={40} gap={3} />
          </div>
        {/if}

        <div class="mt-3 flex items-center justify-center gap-1">
          <button
            class="btn btn-ghost btn-square btn-sm"
            aria-label="Previous track"
            onclick={() => send("previous")}
          >
            <Icon icon="lucide:skip-back" class="size-4" />
          </button>

          <button
            class="btn btn-primary btn-square btn-sm"
            aria-label={status.playing ? "Pause" : "Play"}
            onclick={() => send("playpause")}
          >
            <Icon
              icon={status.playing ? "lucide:pause" : "lucide:play"}
              class="size-4"
            />
          </button>

          <button
            class="btn btn-ghost btn-square btn-sm"
            aria-label="Next track"
            onclick={() => send("next")}
          >
            <Icon icon="lucide:skip-forward" class="size-4" />
          </button>
        </div>

        <div
          class="mt-3 flex items-center gap-2 border-t border-base-content/10 pt-3"
        >
          <Icon
            icon="lucide:volume-2"
            class="size-4 shrink-0 text-base-content/60"
          />

          <input
            type="range"
            class="range range-primary range-xs grow"
            min="0"
            max="100"
            value={Math.round((volume?.level ?? 0) * 100)}
            aria-label="Volume"
            oninput={e =>
              setLevel(Number((e.currentTarget as HTMLInputElement).value) / 100)}
          />

          <span
            class="w-9 shrink-0 text-right text-xs tabular-nums text-base-content/70"
          >
            {Math.round((volume?.level ?? 0) * 100)}%
          </span>
        </div>
      </div>
    {/if}
  </div>
{/if}
