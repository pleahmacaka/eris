<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import * as native from "$lib/native"
  import {
    type MediaAction,
    mediaCommand,
    type MediaStatus,
    mediaStatus,
  } from "$lib/native"
  import type { DockEdge, SpectrumStyle } from "@eris/settings"
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

  const BAR_WIDTH = 10

  let stripWidth = $state(0)
  let cardWidth = $state(0)

  const stripBars = $derived(Math.max(4, Math.floor(stripWidth / BAR_WIDTH)))
  const cardBars = $derived(Math.max(4, Math.floor(cardWidth / BAR_WIDTH)))
</script>

<svelte:window {onmousedown} {onkeydown} />

{#if status}
  <div class="relative" data-media>
    <div
      bind:clientWidth={stripWidth}
      class={[
        "relative isolate flex items-center gap-0.5 overflow-hidden rounded-field border border-base-content/10 px-0.5 transition-colors duration-150",
        open ? "bg-base-content/10" : "bg-base-content/5 hover:bg-base-content/10",
      ]}
      role="group"
      aria-label={$t("tray.media.title")}
    >
      {#if spectrum && status.playing}
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 -z-10 flex justify-center opacity-45"
        >
          <Spectrum
            style={spectrumStyle}
            bars={stripBars}
            height={28}
            gap={0}
            width={BAR_WIDTH}
          />
        </div>
      {/if}

      <button
        class="btn btn-ghost btn-square btn-xs"
        title={$t("tray.media.previous")}
        aria-label={$t("tray.media.previous")}
        onclick={() => send("previous")}
      >
        <Icon icon="lucide:skip-back" class="size-3.5" />
      </button>

      <button
        class={["btn btn-ghost btn-square btn-sm", failed && "text-error"]}
        title={failed ? $t("tray.media.failed") : label}
        aria-label={status.playing ? $t("tray.media.pause") : $t("tray.media.play")}
        onclick={() => send("playpause")}
      >
        <Icon
          icon={status.playing ? "lucide:pause" : "lucide:play"}
          class="size-4"
        />
      </button>

      <button
        class="btn btn-ghost btn-square btn-xs"
        title={$t("tray.media.next")}
        aria-label={$t("tray.media.next")}
        onclick={() => send("next")}
      >
        <Icon icon="lucide:skip-forward" class="size-3.5" />
      </button>

      {#if !compact && status.title}
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
          aria-label={$t("tray.media.nowPlaying")}
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
        bind:clientWidth={cardWidth}
        class={[
          "absolute left-0 isolate z-50 w-80 overflow-hidden rounded-box border border-base-content/10 bg-base-100/90 p-3 shadow-xl backdrop-blur-xl",
          edge === "top" ? "top-full mt-2" : "bottom-full mb-2",
        ]}
        role="dialog"
        aria-label={$t("tray.media.nowPlaying")}
      >
        {#if spectrum && status.playing}
          <div
            class="pointer-events-none absolute inset-x-0 bottom-0 -z-10 flex justify-center opacity-30"
          >
            <Spectrum
              style={spectrumStyle}
              bars={cardBars}
              height={110}
              gap={0}
              width={BAR_WIDTH}
            />
          </div>
        {/if}

        <p class="truncate text-sm font-medium">
          {status.title || $t("tray.media.nothing")}
        </p>

        <p class="mt-0.5 truncate text-xs text-base-content/55">
          {subtitle || $t("tray.media.noInfo")}
        </p>

        <div class="mt-3 flex items-center justify-center gap-1">
          <button
            class="btn btn-ghost btn-square btn-sm"
            aria-label={$t("tray.media.previous")}
            onclick={() => send("previous")}
          >
            <Icon icon="lucide:skip-back" class="size-4" />
          </button>

          <button
            class="btn btn-primary btn-square btn-sm"
            aria-label={status.playing ? $t("tray.media.pause") : $t("tray.media.play")}
            onclick={() => send("playpause")}
          >
            <Icon
              icon={status.playing ? "lucide:pause" : "lucide:play"}
              class="size-4"
            />
          </button>

          <button
            class="btn btn-ghost btn-square btn-sm"
            aria-label={$t("tray.media.next")}
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
            aria-label={$t("tray.volume.title")}
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
