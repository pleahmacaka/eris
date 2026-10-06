<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { NoteLink } from "@eris/settings"
  import { t } from "svelte-i18n"
  import { type Citation, splitCitations } from "$lib/data"
  import { noteLinkable, notePreview, openUrl } from "$lib/native"

  const EXCERPT_LINES = 12
  const GAP = 8
  const WIDTH = 288
  const HEIGHT = 240

  type Hover = { citation: Citation; right: number; top: number }

  let { text, link }: { text: string; link: NoteLink } = $props()

  let linkable = $state(false)
  let hover = $state<Hover | null>(null)
  let previews = $state<Record<string, string | null>>({})

  const parts = $derived(splitCitations(text))

  const references = $derived(linkable && link.enabled && link.references)

  $effect(() => {
    noteLinkable()
      .then(value => (linkable = value))
      .catch(() => undefined)
  })

  const body = (markdown: string) => {
    const lines = markdown.split("\n")

    if (lines[0]?.trim() !== "---") {
      return markdown.trim()
    }

    const close = lines.indexOf("---", 1)

    return lines
      .slice(close < 0 ? 0 : close + 1)
      .join("\n")
      .trim()
  }

  const load = (citation: Citation) => {
    if (citation.path in previews) {
      return
    }

    previews[citation.path] = null
    notePreview(citation.path)
      .then(markdown => (previews[citation.path] = body(markdown)))
      .catch(() => (previews[citation.path] = ""))
  }

  const excerpt = (preview: string) =>
    preview
      .split("\n")
      .filter(line => line.trim() !== "")
      .slice(0, EXCERPT_LINES)
      .join("\n")

  const show = (e: Event, citation: Citation) => {
    if (!link.preview) {
      return
    }

    const chip = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const aside = (e.currentTarget as HTMLElement).closest("aside")?.getBoundingClientRect()

    const floor = aside?.top ?? GAP
    const ceiling = (aside?.bottom ?? innerHeight - GAP) - HEIGHT

    load(citation)
    hover = {
      citation,
      right: innerWidth - (aside?.left ?? chip.left) + GAP,
      top: Math.max(floor, Math.min(chip.top, ceiling)),
    }
  }
</script>

{#snippet chip(part: Citation)}
  {#if references}
    <button
      type="button"
      class="badge badge-sm badge-soft badge-primary gap-1 align-baseline"
      onmouseenter={e => show(e, part)}
      onmouseleave={() => (hover = null)}
      onfocus={e => show(e, part)}
      onblur={() => (hover = null)}
      onclick={() => openUrl(part.url).catch(() => undefined)}
    >
      <Icon icon="lucide:file-text" class="size-3" />
      {part.title}
    </button>
  {:else}
    <span class="font-medium">{part.title}</span>
  {/if}
{/snippet}

<p class="text-sm leading-relaxed whitespace-pre-line break-words text-base-content/85">
  {#each parts as part, index (index)}{#if typeof part === "string"}{part}{:else}{@render chip(part)}{/if}{/each}
</p>

{#if hover}
  {@const preview = previews[hover.citation.path]}

  <section
    role="tooltip"
    class="eris-card pointer-events-none fixed z-50 flex flex-col gap-2 overflow-hidden p-3"
    style:right="{hover.right}px"
    style:top="{hover.top}px"
    style:width="{WIDTH}px"
    style:max-height="{HEIGHT}px"
  >
    <header class="flex items-center gap-2">
      <Icon icon="lucide:file-text" class="size-4 shrink-0 text-primary" />

      <h4 class="min-w-0 grow truncate text-sm font-semibold">{hover.citation.title}</h4>
    </header>

    {#if preview === null}
      <span class="loading loading-dots loading-sm text-base-content/50"></span>
    {:else if preview}
      <p class="text-xs leading-relaxed whitespace-pre-line break-words text-base-content/75">
        {excerpt(preview)}
      </p>
    {:else}
      <p class="text-xs text-base-content/50">{$t("panel.event.previewMissing")}</p>
    {/if}
  </section>
{/if}
