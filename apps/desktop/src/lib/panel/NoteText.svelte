<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { type Citation, splitCitations } from "$lib/data"
  import { noteLinkable, notePreview, openUrl } from "$lib/native"

  const EXCERPT_LINES = 8

  let { text }: { text: string } = $props()

  let linkable = $state(false)
  let opened = $state<Citation | null>(null)
  let previews = $state<Record<string, string | null>>({})

  const parts = $derived(splitCitations(text))

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

  const excerpt = (citation: Citation) => {
    const preview = previews[citation.path]

    if (!preview) {
      return citation.title
    }

    return preview
      .split("\n")
      .filter(line => line.trim() !== "")
      .slice(0, EXCERPT_LINES)
      .join("\n")
  }

  const toggle = (citation: Citation) => {
    load(citation)
    opened = opened?.url === citation.url ? null : citation
  }
</script>

{#snippet chip(part: Citation)}
  {#if linkable}
    <button
      type="button"
      class={[
        "badge badge-sm gap-1 align-baseline",
        opened?.url === part.url ? "badge-primary" : "badge-soft badge-primary",
      ]}
      title={excerpt(part)}
      aria-expanded={opened?.url === part.url}
      onmouseenter={() => load(part)}
      onfocus={() => load(part)}
      onclick={() => toggle(part)}
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

{#if opened}
  {@const preview = previews[opened.path]}

  <section class="mt-2 flex flex-col gap-2 rounded-box border border-base-content/10 bg-base-200/60 p-3">
    <header class="flex items-center gap-2">
      <Icon icon="lucide:file-text" class="size-4 shrink-0 text-primary" />

      <h4 class="min-w-0 grow truncate text-sm font-semibold">{opened.title}</h4>

      <button
        type="button"
        class="btn btn-soft btn-primary btn-xs"
        onclick={() => opened && openUrl(opened.url).catch(() => undefined)}
      >
        {$t("panel.event.openInNote")}
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-square btn-xs"
        aria-label={$t("common.close")}
        onclick={() => (opened = null)}
      >
        <Icon icon="lucide:x" class="size-3.5" />
      </button>
    </header>

    {#if preview === null}
      <span class="loading loading-dots loading-sm text-base-content/50"></span>
    {:else if preview}
      <p class="max-h-48 overflow-y-auto text-xs leading-relaxed whitespace-pre-line break-words text-base-content/75 select-text">
        {preview}
      </p>
    {:else}
      <p class="text-xs text-base-content/50">{$t("panel.event.previewMissing")}</p>
    {/if}
  </section>
{/if}
