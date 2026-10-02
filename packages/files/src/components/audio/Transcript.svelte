<script lang="ts">
  import { t } from "svelte-i18n"
  import { clock, type Transcript } from "./audio"

  let {
    transcript,
    query,
    current,
    playing,
    onseek,
  }: {
    transcript: Transcript | null
    query: string
    current: number
    playing: boolean
    onseek: (seconds: number) => void
  } = $props()

  let rows = $state<HTMLElement[]>([])

  const segments = $derived(transcript?.segments ?? [])

  const active = $derived(segments.findLastIndex(s => s.start <= current))

  const needle = $derived(query.trim().toLowerCase())

  const shown = $derived(
    segments
      .map((segment, index) => ({ segment, index }))
      .filter(
        ({ segment }) =>
          !needle ||
          segment.text.toLowerCase().includes(needle) ||
          !!segment.speaker?.toLowerCase().includes(needle),
      ),
  )

  $effect(() => {
    if (playing && !needle && active >= 0) {
      rows[active]?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  })

  const parts = (text: string) => {
    if (!needle) {
      return [{ text, hit: false }]
    }

    const lower = text.toLowerCase()
    const found: { text: string; hit: boolean }[] = []
    let from = 0

    for (
      let at = lower.indexOf(needle);
      at >= 0;
      at = lower.indexOf(needle, from)
    ) {
      found.push({ text: text.slice(from, at), hit: false })
      found.push({ text: text.slice(at, at + needle.length), hit: true })
      from = at + needle.length
    }

    found.push({ text: text.slice(from), hit: false })

    return found.filter(part => part.text)
  }
</script>

{#if !transcript}
  <p class="py-6 text-center text-sm text-base-content/50">
    {$t("audio.empty")}
  </p>
{:else if !shown.length}
  <p class="py-6 text-center text-sm text-base-content/50">
    {$t("audio.noMatches")}
  </p>
{:else}
  <ol class="flex flex-col gap-0.5">
    {#each shown as { segment, index } (index)}
      <li
        bind:this={rows[index]}
        class={[
          "flex gap-3 rounded-field px-2 py-1.5 transition-colors",
          index === active && (playing || current > 0)
            ? "bg-primary/10"
            : "hover:bg-base-content/5",
        ]}
      >
        <button
          type="button"
          class={[
            "w-12 shrink-0 pt-0.5 text-left text-xs tabular-nums",
            "text-base-content/50 hover:text-primary",
          ]}
          onclick={() => onseek(segment.start)}
        >
          {clock(segment.start)}
        </button>

        <div class="flex min-w-0 flex-col gap-0.5">
          {#if segment.speaker}
            <span class="text-xs text-base-content/50">
              {segment.speaker}
            </span>
          {/if}

          <p class="text-sm leading-relaxed break-words select-text">
            {#each parts(segment.text) as part, at (at)}
              {#if part.hit}
                <mark class="rounded-sm bg-warning/40 text-inherit">
                  {part.text}
                </mark>
              {:else}
                {part.text}
              {/if}
            {/each}
          </p>
        </div>
      </li>
    {/each}
  </ol>
{/if}
