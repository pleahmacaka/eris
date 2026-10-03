<script module lang="ts">
  import { persisted } from "../../store/persisted.svelte"

  const sound = persisted("eris-files.audio", { volume: 1, muted: false })
</script>

<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { Confirm, toast } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { formatBytes } from "../../format"
  import { baseName } from "../../locations"
  import { allowPreview, assetUrl } from "../../native"
  import {
    audioWaveform,
    clock,
    type Details,
    decodePeaks,
    type Progress,
    readTranscript,
    type Transcript as Saved,
    transcribe,
  } from "./audio"
  import { transcribeSettings } from "./transcribe.svelte"
  import Transcript from "./Transcript.svelte"
  import Waveform from "./Waveform.svelte"

  const SEEK_STEP = 5
  const FALLBACK_LIMIT = 16 * 1024 * 1024
  const ERRORS = [
    "noKey",
    "badKey",
    "rateLimited",
    "network",
    "tooLarge",
    "unsupported",
    "missing",
    "provider",
  ]

  let { path }: { path: string } = $props()

  let player = $state<HTMLAudioElement>()
  let source = $state("")
  let peaks = $state<number[] | null>(null)
  let size = $state<number | null>(null)
  let details = $state<Details | null>(null)
  let showSource = $state(false)
  let duration = $state(0)
  let current = $state(0)
  let playing = $state(false)
  let transcript = $state<Saved | null>(null)
  let query = $state("")
  let progress = $state<Progress | null>(null)
  let confirming = $state(false)
  let root = $state<HTMLElement>()

  $effect(() => {
    let live = true

    const allowed = allowPreview(path).then(() => {
      if (live) {
        source = assetUrl(path)
      }
    })

    allowed.catch(() => toast($t("audio.errors.missing"), "error"))

    audioWaveform(path)
      .then(async waveform => {
        if (!live) {
          return
        }

        size = waveform.size
        details = waveform.details
        duration = waveform.duration ?? duration
        peaks = waveform.peaks

        if (!waveform.peaks && waveform.size <= FALLBACK_LIMIT) {
          await allowed

          const decoded = await decodePeaks(assetUrl(path))

          if (live) {
            peaks = decoded
          }
        }
      })
      .catch(() => undefined)

    readTranscript(path)
      .then(found => {
        if (live) {
          transcript = found
        }
      })
      .catch(() => undefined)

    return () => {
      live = false
    }
  })

  $effect(() => {
    if (!playing) {
      return
    }

    let frame = 0

    const tick = () => {
      current = player?.currentTime ?? current
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  })

  const toggle = () => {
    if (!player) {
      return
    }

    if (player.paused) {
      player.play().catch(() => toast($t("audio.errors.unsupported"), "error"))
    } else {
      player.pause()
    }
  }

  const seek = (seconds: number) => {
    const at = Math.min(duration || seconds, Math.max(0, seconds))

    current = at

    if (player) {
      player.currentTime = at
    }
  }

  const MOVES: Record<string, () => void> = {
    " ": toggle,
    ArrowLeft: () => seek(current - SEEK_STEP),
    ArrowRight: () => seek(current + SEEK_STEP),
  }

  const onkeydowncapture = (e: KeyboardEvent) => {
    const move = MOVES[e.key]
    const target = e.target as Node | null
    const inside = target === document.body || !!root?.contains(target)

    if (!move || !inside || e.altKey || e.ctrlKey) {
      return
    }

    if (target instanceof HTMLInputElement) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    move()
  }

  const errorText = (reason: unknown) => {
    const code = String(reason)

    return ERRORS.includes(code) ? $t(`audio.errors.${code}`) : code
  }

  const run = async () => {
    progress = { stage: "uploading", done: 0, total: 1 }

    try {
      const result = await transcribe(
        path,
        transcribeSettings.provider,
        transcribeSettings.model,
        transcribeSettings.language,
        next => (progress = next),
      )

      transcript = result.transcript

      if (!result.saved) {
        toast($t("audio.errors.saveFailed"), "error")
      }
    } catch (reason) {
      toast(errorText(reason), "error")
    } finally {
      progress = null
    }
  }

  const request = () => {
    if (transcript) {
      confirming = true
    } else {
      run()
    }
  }

  const progressText = (value: Progress) =>
    value.stage === "decoding"
      ? $t("audio.progress.decoding")
      : $t("audio.progress.uploading", {
          values: { done: value.done, total: value.total },
        })

  const facts = $derived.by(() => {
    if (!details) {
      return []
    }

    const locale = currentLocale()
    const bitrate =
      size && duration ? Math.round((size * 8) / duration / 1000) : null

    const entries: [string, string | number | null][] = [
      ["title", details.title],
      ["artist", details.artist],
      ["album", details.album],
      ["year", details.year],
      ["track", details.track],
      ["genre", details.genre],
      [
        "sampleRate",
        details.sampleRate &&
          `${(details.sampleRate / 1000).toLocaleString(locale)} kHz`,
      ],
      [
        "channels",
        details.channels &&
          $t("audio.channelCount", { values: { count: details.channels } }),
      ],
      ["bitrate", bitrate && `${bitrate.toLocaleString(locale)} kbps`],
    ]

    return entries.filter(([, value]) => !!value)
  })

  const volumeIcon = $derived(
    sound.muted || sound.volume === 0
      ? "lucide:volume-x"
      : sound.volume < 0.5
        ? "lucide:volume-1"
        : "lucide:volume-2",
  )

  const providerLabel = (value: Saved) =>
    value.provider === "custom"
      ? value.host
      : $t(`audio.providers.${value.provider}`)
</script>

<svelte:window {onkeydowncapture} />

<section
  class="flex min-h-0 min-w-0 grow flex-col overflow-y-auto outline-none"
  aria-label={baseName(path)}
  tabindex="-1"
  bind:this={root}
  {@attach node => node.focus({ preventScroll: true })}
>
  <audio
    bind:this={player}
    src={source || undefined}
    preload="metadata"
    bind:volume={sound.volume}
    bind:muted={sound.muted}
    onloadedmetadata={e => {
      if (Number.isFinite(e.currentTarget.duration)) {
        duration = e.currentTarget.duration
      }
    }}
    onplay={() => (playing = true)}
    onpause={() => {
      playing = false
      current = player?.currentTime ?? current
    }}
    onended={() => (playing = false)}
    onerror={() => toast($t("audio.errors.unsupported"), "error")}
  ></audio>

  <div class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-5">
    <header class="flex items-baseline justify-between gap-4">
      <h2 class="truncate text-sm font-semibold" title={baseName(path)}>
        {baseName(path)}
      </h2>

      <div
        class="flex shrink-0 gap-3 text-xs tabular-nums text-base-content/60"
      >
        {#if duration}
          <span>{clock(duration)}</span>
        {/if}

        {#if size !== null}
          <span>{formatBytes(size, currentLocale())}</span>
        {/if}
      </div>
    </header>

    {#if facts.length || details?.cover}
      <div class="flex items-start gap-4">
        {#if details?.cover}
          <img
            src={details.cover}
            alt=""
            class="size-16 shrink-0 rounded-box object-cover"
          />
        {/if}

        <dl
          class="grid min-w-0 grow grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3"
          aria-label={$t("audio.details")}
        >
          {#each facts as [key, value] (key)}
            <div class="flex min-w-0 gap-2">
              <dt class="shrink-0 text-base-content/50">
                {$t(`audio.meta.${key}`)}
              </dt>
              <dd class="truncate tabular-nums" title={String(value)}>{value}</dd>
            </div>
          {/each}
        </dl>
      </div>
    {/if}

    <div
      class={[
        "flex items-center gap-4 rounded-box border border-base-content/10",
        "bg-base-200/60 px-4 py-3",
      ]}
    >
      <button
        type="button"
        class="btn btn-circle btn-primary btn-sm shrink-0"
        aria-label={playing ? $t("audio.pause") : $t("audio.play")}
        disabled={!source}
        onclick={toggle}
      >
        <Icon icon={playing ? "lucide:pause" : "lucide:play"} class="size-4" />
      </button>

      <Waveform
        {peaks}
        progress={duration ? current / duration : 0}
        label={$t("audio.position")}
        onseek={fraction => seek(fraction * duration)}
      />

      <span class="shrink-0 text-xs tabular-nums text-base-content/70">
        {clock(current)} / {clock(duration)}
      </span>

      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square"
          aria-label={sound.muted ? $t("audio.unmute") : $t("audio.mute")}
          aria-pressed={sound.muted}
          onclick={() => (sound.muted = !sound.muted)}
        >
          <Icon icon={volumeIcon} class="size-4" />
        </button>

        <input
          type="range"
          class="range range-primary range-xs w-20"
          min="0"
          max="1"
          step="0.05"
          aria-label={$t("audio.volume")}
          bind:value={sound.volume}
          oninput={() => (sound.muted = false)}
        />
      </div>
    </div>

    <label class="input input-sm w-full">
      <Icon icon="lucide:search" class="size-3.5 text-base-content/50" />
      <input
        type="search"
        placeholder={$t("audio.search")}
        aria-label={$t("audio.search")}
        bind:value={query}
        disabled={!transcript?.segments.length}
      />
    </label>

    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <h3 class="text-xs font-medium text-base-content/60">
          {$t("audio.transcript")}
        </h3>

        {#if transcript}
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-square"
            aria-label={$t("audio.source")}
            aria-expanded={showSource}
            onclick={() => (showSource = !showSource)}
          >
            <Icon icon="lucide:info" class="size-3.5" />
          </button>

          {#if showSource}
            <span class="badge badge-ghost badge-sm">
              {providerLabel(transcript)}
            </span>
            <span class="badge badge-ghost badge-sm truncate">
              {transcript.model}
            </span>
          {/if}
        {/if}
      </div>

      {#if progress}
        <div class="flex shrink-0 items-center gap-2 text-xs text-base-content/70">
          <span class="loading loading-spinner loading-xs"></span>
          {progressText(progress)}
        </div>
      {:else}
        <button type="button" class="btn btn-ghost btn-xs" onclick={request}>
          <Icon icon="lucide:audio-lines" class="size-3.5" />
          {transcript ? $t("audio.retranscribe") : $t("audio.transcribe")}
        </button>
      {/if}
    </div>

    {#if progress?.stage === "uploading" && progress.total > 1}
      <progress
        class="progress progress-primary w-full"
        value={progress.done}
        max={progress.total}
      ></progress>
    {/if}

    <Transcript {transcript} {query} {current} {playing} onseek={seek} />
  </div>
</section>

<Confirm
  bind:open={confirming}
  title={$t("audio.replaceTitle")}
  body={$t("audio.replaceBody")}
  action={$t("audio.retranscribe")}
  onconfirm={run}
/>
