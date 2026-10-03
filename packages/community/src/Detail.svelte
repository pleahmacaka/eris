<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { CommunityCopy, Surface } from "./copy"
  import Stage from "./Stage.svelte"
  import { type CommunityTheme, type Tool, toolsOf } from "./support"

  let {
    t,
    studio,
    theme,
    liked,
    mine,
    copied,
    onback,
    onlike,
    onapply,
    oncopy,
    onedit,
    onremove,
  }: {
    t: CommunityCopy
    studio?: string
    theme: CommunityTheme
    liked: boolean
    mine: boolean
    copied: boolean
    onback: () => void
    onlike: () => void
    onapply: () => void
    oncopy: () => void
    onedit: () => void
    onremove: () => void
  } = $props()

  const SURFACE_OF: Record<Tool, Surface> = {
    eris: "desktop",
    files: "files",
    terminal: "terminal",
  }

  let chosen = $state<Surface>("desktop")
  let confirming = $state(false)

  const tools = $derived(toolsOf(theme))

  const surfaces = $derived(tools.map(tool => SURFACE_OF[tool]))

  const surface = $derived(surfaces.includes(chosen) ? chosen : (surfaces[0] ?? "desktop"))

  const remove = () => {
    if (confirming) {
      onremove()
    }

    confirming = !confirming
  }
</script>

<article class="flex flex-col gap-6">
  <button type="button" class="btn btn-ghost btn-sm self-start" onclick={onback}>
    <Icon icon="lucide:arrow-left" class="size-4" />
    {t.back}
  </button>

  <div class="flex flex-wrap items-end justify-between gap-4">
    <div class="flex flex-col gap-1">
      <h1 class="text-3xl font-bold tracking-tight">{theme.name}</h1>
      <p class="text-sm text-base-content/60">{t.by(theme.author)}</p>
    </div>

    <div class="flex items-center gap-4 text-sm text-base-content/70 tabular-nums">
      <span class="flex items-center gap-1.5" title={t.likes}>
        <Icon icon="lucide:heart" class="size-4" />
        {theme.likes}
      </span>
      <span class="flex items-center gap-1.5" title={t.downloads}>
        <Icon icon="lucide:download" class="size-4" />
        {theme.downloads}
      </span>
    </div>
  </div>

  <div class="overflow-hidden rounded-box border border-base-content/10">
    <Stage
      {studio}
      appearance={theme.appearance}
      {surface}
      title={t.surfaces[surface]}
      unavailable={t.previewUnavailable}
    />
  </div>

  {#if surfaces.length > 1}
    <div role="tablist" class="tabs tabs-box self-start">
      {#each surfaces as option (option)}
        <button
          type="button"
          role="tab"
          class={["tab", surface === option && "tab-active"]}
          aria-selected={surface === option}
          onclick={() => (chosen = option)}
        >
          {t.surfaces[option]}
        </button>
      {/each}
    </div>
  {/if}

  <div class="grid gap-6 lg:grid-cols-3">
    <div class="flex flex-col gap-4 lg:col-span-2">
      {#if theme.description}
        <p class="text-base-content/80">{theme.description}</p>
      {/if}

      <div class="flex flex-wrap gap-1.5" aria-label={t.supports}>
        {#each tools as tool (tool)}
          <span class="badge badge-soft badge-primary badge-sm">{t.tools[tool]}</span>
        {/each}

        {#each theme.tags as tag (tag)}
          <span class="badge badge-ghost badge-sm">#{tag}</span>
        {/each}
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <button type="button" class="btn btn-primary" onclick={onapply}>
        <Icon icon="lucide:sparkles" class="size-4" />
        {t.apply}
      </button>
      <p class="text-xs text-base-content/60">{t.applyHint}</p>

      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="btn btn-soft btn-sm" onclick={oncopy}>
          <Icon icon={copied ? "lucide:check" : "lucide:copy"} class="size-4" />
          {copied ? t.copied : t.copyJson}
        </button>

        <button
          type="button"
          class={["btn btn-sm", liked ? "btn-secondary" : "btn-soft"]}
          aria-pressed={liked}
          onclick={onlike}
        >
          <Icon icon="lucide:heart" class="size-4" />
          {liked ? t.liked : t.like}
        </button>
      </div>

      {#if mine}
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="btn btn-ghost btn-sm" onclick={onedit}>
            <Icon icon="lucide:pencil" class="size-4" />
            {t.edit}
          </button>

          <button
            type="button"
            class={["btn btn-sm", confirming ? "btn-error" : "btn-ghost"]}
            onclick={remove}
            onblur={() => (confirming = false)}
          >
            <Icon icon="lucide:trash-2" class="size-4" />
            {confirming ? t.confirmRemove : t.remove}
          </button>
        </div>
      {/if}
    </div>
  </div>
</article>
