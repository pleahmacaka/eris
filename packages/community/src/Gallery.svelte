<script lang="ts">
  import Icon from "@iconify/svelte"
  import { onMount } from "svelte"
  import { type CommunityLang, copy } from "./copy"
  import Detail from "./Detail.svelte"
  import Stage from "./Stage.svelte"
  import {
    applyLink,
    type Browse,
    browse,
    type CommunityTheme,
    MODES,
    TOOLS,
    tagsOf,
    toolsOf,
  } from "./support"
  import { seeds } from "./themes"

  let {
    lang,
    studio,
    home,
    languages,
  }: {
    lang: CommunityLang
    studio?: string
    home: string
    languages: { code: CommunityLang; label: string; href: string }[]
  } = $props()

  const SEARCH_DELAY = 250
  const COPIED_FOR = 1600

  const BLANK: Browse = { q: "", tool: "", mode: "", tag: "" }

  const KEYS = ["q", "tool", "mode", "tag"] as const

  const tags = tagsOf(seeds)

  const t = $derived(copy[lang])

  let query = $state<Browse>({ ...BLANK })
  let search = $state("")
  let currentId = $state<string | null>(null)
  let copiedId = $state("")
  let ready = $state(false)

  const shown = $derived(browse(seeds, query))

  const filtered = $derived(
    query.q !== "" || query.tool !== "" || query.mode !== "" || query.tag !== "",
  )

  const current = $derived(seeds.find(theme => theme.id === currentId) ?? null)

  const option = <T extends string>(options: readonly T[], value: string | null) =>
    options.find(candidate => candidate === value)

  const readUrl = () => {
    const params = new URLSearchParams(location.search)

    query = {
      q: params.get("q") ?? "",
      tool: option(TOOLS, params.get("tool")) ?? "",
      mode: option(MODES, params.get("mode")) ?? "",
      tag: params.get("tag") ?? "",
    }
    search = query.q
    currentId = params.get("theme")
  }

  const urlOf = (id: string | null) => {
    const params = new URLSearchParams()

    for (const key of KEYS) {
      if (query[key] !== BLANK[key]) {
        params.set(key, query[key])
      }
    }

    if (id) {
      params.set("theme", id)
    }

    const text = params.toString()

    return text ? `?${text}` : location.pathname
  }

  const go = (id: string | null) => {
    currentId = id
    history.pushState(null, "", urlOf(id))
    scrollTo({ top: 0 })
  }

  const copyJson = async (theme: CommunityTheme) => {
    await navigator.clipboard.writeText(`${JSON.stringify(theme.appearance, null, 2)}\n`)

    copiedId = theme.id
    setTimeout(() => {
      if (copiedId === theme.id) {
        copiedId = ""
      }
    }, COPIED_FOR)
  }

  const open = (e: MouseEvent, theme: CommunityTheme) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) {
      return
    }

    e.preventDefault()
    go(theme.id)
  }

  $effect(() => {
    const q = search
    const timer = setTimeout(() => {
      query.q = q
    }, SEARCH_DELAY)

    return () => clearTimeout(timer)
  })

  $effect(() => {
    if (ready) {
      history.replaceState(null, "", urlOf(currentId))
    }
  })

  onMount(() => {
    readUrl()
    ready = true

    addEventListener("popstate", readUrl)

    return () => removeEventListener("popstate", readUrl)
  })
</script>

<svelte:head>
  <title>{current?.name ?? t.title}: Eris</title>
  <meta name="description" content={t.lead} />
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 sm:px-10">
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

  {#if current}
    <Detail
      {t}
      {studio}
      theme={current}
      copied={copiedId === current.id}
      onback={() => go(null)}
      onapply={() => (location.href = applyLink(current))}
      oncopy={() => copyJson(current)}
    />
  {:else}
    <section class="flex flex-col gap-2">
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">{t.title}</h1>
      <p class="max-w-2xl text-base-content/70">{t.lead}</p>
    </section>

    <section class="flex flex-col gap-3" aria-label={t.search}>
      <div class="flex flex-wrap gap-2">
        <label class="input grow">
          <Icon icon="lucide:search" class="size-4 text-base-content/60" />
          <input type="search" placeholder={t.search} bind:value={search} />
        </label>

        <select class="select w-auto" aria-label={t.anyTool} bind:value={query.tool}>
          <option value="">{t.anyTool}</option>
          {#each TOOLS as tool (tool)}
            <option value={tool}>{t.tools[tool]}</option>
          {/each}
        </select>

        <select class="select w-auto" aria-label={t.anyMode} bind:value={query.mode}>
          <option value="">{t.anyMode}</option>
          {#each MODES as mode (mode)}
            <option value={mode}>{t.modes[mode]}</option>
          {/each}
        </select>
      </div>

      {#if tags.length}
        <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label={t.tags}>
          <button
            type="button"
            class={["btn btn-xs", query.tag === "" ? "btn-primary" : "btn-ghost"]}
            aria-pressed={query.tag === ""}
            onclick={() => (query.tag = "")}
          >
            {t.allTags}
          </button>

          {#each tags as tag (tag)}
            <button
              type="button"
              class={["btn btn-xs", query.tag === tag ? "btn-primary" : "btn-ghost"]}
              aria-pressed={query.tag === tag}
              onclick={() => (query.tag = query.tag === tag ? "" : tag)}
            >
              #{tag}
            </button>
          {/each}
        </div>
      {/if}

      <div class="flex items-center justify-between gap-2 text-sm text-base-content/60">
        <span aria-live="polite">{t.count(shown.length)}</span>

        {#if filtered}
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            onclick={() => {
              search = ""
              query = { ...BLANK }
            }}
          >
            {t.clear}
          </button>
        {/if}
      </div>
    </section>

    {#if shown.length}
      <section class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {#each shown as theme (theme.id)}
          <a
            class={[
              "card group overflow-hidden border border-base-content/10 bg-base-200/60",
              "transition-colors hover:border-primary/50",
            ]}
            href={`?theme=${encodeURIComponent(theme.id)}`}
            onclick={e => open(e, theme)}
          >
            <Stage
              {studio}
              appearance={theme.appearance}
              surface="desktop"
              title={theme.name}
              unavailable={t.previewUnavailable}
              still
            />

            <div class="card-body gap-2 p-4">
              <div class="min-w-0">
                <h2 class="truncate font-semibold">{theme.name}</h2>
                <p class="truncate text-xs text-base-content/60">{t.by(theme.author)}</p>
              </div>

              {#if theme.description}
                <p class="line-clamp-2 text-sm text-base-content/75">{theme.description}</p>
              {/if}

              <div class="mt-1 flex flex-wrap gap-1">
                {#each toolsOf(theme) as tool (tool)}
                  <span class="badge badge-soft badge-primary badge-xs">{t.tools[tool]}</span>
                {/each}
              </div>
            </div>
          </a>
        {/each}
      </section>
    {:else}
      <p class="py-16 text-center text-base-content/60">{t.empty}</p>
    {/if}
  {/if}
</div>
