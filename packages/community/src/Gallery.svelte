<script lang="ts">
  import Icon from "@iconify/svelte"
  import { type CommunityLang, copy, type Surface } from "./copy"
  import { type CommunityTheme, previewUrl, type Tool, toolsOf } from "./support"
  import { themes } from "./themes"

  type Frame = {
    title: string
    path: string
    width: number
    height: number
    top: number
    left: number
  }

  let {
    lang,
    studio,
    home,
    submit,
    languages,
  }: {
    lang: CommunityLang
    studio?: string
    home: string
    submit: string
    languages: { code: CommunityLang; label: string; href: string }[]
  } = $props()

  const SCREEN = { width: 1280, height: 720 }
  const DOCK_HEIGHT = 48
  const COPIED_FOR = 1600

  const SURFACE_OF: Record<Tool, Surface> = {
    eris: "desktop",
    files: "files",
    terminal: "terminal",
  }

  const centered = (title: string, path: string, width: number, height: number): Frame => ({
    title,
    path,
    width,
    height,
    top: (SCREEN.height - DOCK_HEIGHT - height) / 2,
    left: (SCREEN.width - width) / 2,
  })

  const t = $derived(copy[lang])

  const frames = $derived<Record<Surface, Frame[]>>({
    desktop: [
      centered(t.tools.eris, "/", 680, 420),
      {
        title: t.tools.eris,
        path: "/taskbar",
        width: SCREEN.width,
        height: DOCK_HEIGHT,
        top: SCREEN.height - DOCK_HEIGHT,
        left: 0,
      },
    ],
    files: [centered(t.tools.files, "/files", 1040, 600)],
    terminal: [centered(t.tools.terminal, "/terminal", 960, 560)],
  })

  let selectedId = $state(themes[0]?.id ?? "")
  let chosen = $state<Surface>("desktop")
  let copiedId = $state("")
  let stageWidth = $state(0)

  const selected = $derived(themes.find(theme => theme.id === selectedId) ?? null)

  const available = $derived(selected ? toolsOf(selected).map(tool => SURFACE_OF[tool]) : [])

  const surface = $derived(available.includes(chosen) ? chosen : (available[0] ?? "desktop"))

  const scale = $derived(stageWidth / SCREEN.width)

  const copyJson = async (theme: CommunityTheme) => {
    await navigator.clipboard.writeText(`${JSON.stringify(theme, null, 2)}\n`)

    copiedId = theme.id
    setTimeout(() => {
      if (copiedId === theme.id) {
        copiedId = ""
      }
    }, COPIED_FOR)
  }
</script>

<svelte:head>
  <title>{t.title}: Eris</title>
  <meta name="description" content={t.lead} />
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10 sm:px-10">
  <header class="flex items-center justify-between gap-4 text-sm">
    <a class="link link-hover font-semibold" href={home}>{t.home}</a>

    <nav aria-label={t.languages} class="flex items-center gap-3">
      {#each languages as l (l.code)}
        <a
          class={["link link-hover", l.code === lang ? "font-medium" : "text-base-content/70"]}
          href={l.href}
          hreflang={l.code}
          lang={l.code}
          aria-current={l.code === lang ? "page" : undefined}
          data-sveltekit-reload
        >
          {l.label}
        </a>
      {/each}
    </nav>
  </header>

  <section class="flex flex-col gap-4">
    <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">{t.title}</h1>
    <p class="max-w-2xl text-base-content/70">{t.lead}</p>

    <div class="flex flex-wrap items-center gap-3">
      <a class="btn btn-primary btn-sm" href={submit} target="_blank" rel="noreferrer">
        {t.submit}
      </a>
      <span class="text-sm text-base-content/60">{t.apply}</span>
    </div>
  </section>

  {#if selected}
    <section class="flex flex-col gap-4" aria-label={t.preview}>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm">
          <span class="text-base-content/60">{t.previewing}</span>
          <span class="font-semibold">{selected.name}</span>
        </p>

        <div class="join" role="tablist">
          {#each available as option (option)}
            <button
              type="button"
              role="tab"
              class={["btn join-item btn-sm", surface === option ? "btn-active" : "btn-ghost"]}
              aria-selected={surface === option}
              onclick={() => (chosen = option)}
            >
              {t.surfaces[option]}
            </button>
          {/each}
        </div>
      </div>

      <div
        class="stage relative aspect-video w-full overflow-hidden rounded-box border border-base-content/10"
        bind:clientWidth={stageWidth}
      >
        {#if studio}
          <div
            class="absolute top-0 left-0 origin-top-left"
            style:width="{SCREEN.width}px"
            style:height="{SCREEN.height}px"
            style:transform="scale({scale})"
          >
            {#key `${selected.id}:${surface}`}
              {#each frames[surface] as frame (frame.path)}
                <iframe
                  title={frame.title}
                  src={previewUrl(studio, frame.path, selected)}
                  class="absolute"
                  style:top="{frame.top}px"
                  style:left="{frame.left}px"
                  style:width="{frame.width}px"
                  style:height="{frame.height}px"
                  loading="lazy"
                ></iframe>
              {/each}
            {/key}
          </div>
        {:else}
          <p class="absolute inset-0 m-auto flex items-center justify-center text-sm text-base-content/60">
            {t.previewUnavailable}
          </p>
        {/if}
      </div>
    </section>
  {/if}

  <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each themes as theme (theme.id)}
      {@const tools = toolsOf(theme)}
      {@const active = theme.id === selectedId}

      <article
        class={[
          "card border bg-base-200/60",
          active ? "border-primary/60" : "border-base-content/10",
        ]}
      >
        <div class="card-body gap-3">
          <div class="flex items-center gap-1.5" aria-hidden="true">
            {#each theme.swatch as color, index (index)}
              <span class="size-5 rounded-full border border-base-content/15" style:background-color={color}></span>
            {/each}
          </div>

          <div>
            <h2 class="card-title text-lg">{theme.name}</h2>
            <p class="text-xs text-base-content/60">{t.author(theme.author)}</p>
          </div>

          <p class="text-sm text-base-content/80">{theme.description}</p>

          <div class="flex flex-col gap-1.5">
            <span class="text-xs text-base-content/60">{t.supports}</span>

            <ul class="flex flex-wrap gap-1.5">
              {#each tools as tool (tool)}
                <li class="badge badge-soft badge-primary badge-sm">{t.tools[tool]}</li>
              {/each}
            </ul>
          </div>

          <div class="card-actions mt-1 justify-end">
            <button type="button" class="btn btn-ghost btn-sm" onclick={() => copyJson(theme)}>
              <Icon icon={copiedId === theme.id ? "lucide:check" : "lucide:copy"} class="size-4" />
              {copiedId === theme.id ? t.copied : t.copyJson}
            </button>

            <button
              type="button"
              class={["btn btn-sm", active ? "btn-primary" : "btn-soft"]}
              aria-pressed={active}
              onclick={() => (selectedId = theme.id)}
            >
              {t.preview}
            </button>
          </div>
        </div>
      </article>
    {/each}
  </section>
</div>

<style>
  .stage {
    background-color: var(--color-base-300);
    background-image:
      radial-gradient(
        60% 50% at 20% 10%,
        color-mix(in oklch, var(--color-primary) 22%, transparent),
        transparent 70%
      ),
      radial-gradient(
        50% 60% at 90% 90%,
        color-mix(in oklch, var(--color-secondary) 16%, transparent),
        transparent 70%
      );
  }

  iframe {
    border: 0;
    background: transparent;
    color-scheme: normal;
  }
</style>
