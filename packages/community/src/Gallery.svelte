<script lang="ts">
  import { type Account, webAccount } from "@eris/auth"
  import Icon from "@iconify/svelte"
  import { onMount } from "svelte"
  import { countDownload, loadLiked, loadThemes, remove, setLiked } from "./api"
  import { type CommunityLang, copy } from "./copy"
  import Detail from "./Detail.svelte"
  import Editor from "./Editor.svelte"
  import Stage from "./Stage.svelte"
  import {
    applyLink,
    type Browse,
    browse,
    type CommunityTheme,
    MODES,
    SORTS,
    TOOLS,
    tagsOf,
    toolsOf,
  } from "./support"
  import { seeds } from "./themes"

  type View =
    | { kind: "list" }
    | { kind: "theme"; slug: string }
    | { kind: "edit"; slug: string | null }

  let {
    lang,
    studio,
    home,
    login,
    languages,
  }: {
    lang: CommunityLang
    studio?: string
    home: string
    login: string
    languages: { code: CommunityLang; label: string; href: string }[]
  } = $props()

  const SEARCH_DELAY = 250
  const COPIED_FOR = 1600

  const BLANK: Browse = { q: "", sort: "popular", tool: "", mode: "", tag: "" }

  const KEYS = ["q", "sort", "tool", "mode", "tag"] as const

  const t = $derived(copy[lang])

  let themes = $state.raw<CommunityTheme[]>(seeds)
  let live = $state(false)
  let liked = $state.raw(new Set<string>())
  let account = $state<Account | null>(null)
  let query = $state<Browse>({ ...BLANK })
  let search = $state("")
  let view = $state<View>({ kind: "list" })
  let copiedId = $state("")
  let ready = $state(false)

  const shown = $derived(browse(themes, query))

  const tags = $derived(tagsOf(themes))

  const filtered = $derived(
    query.q !== "" || query.tool !== "" || query.mode !== "" || query.tag !== "",
  )

  const currentSlug = $derived(view.kind === "list" ? null : view.slug)

  const current = $derived(themes.find(theme => theme.slug === currentSlug) ?? null)

  const option = <T extends string>(options: readonly T[], value: string | null) =>
    options.find(candidate => candidate === value)

  const readUrl = () => {
    const params = new URLSearchParams(location.search)

    query = {
      q: params.get("q") ?? "",
      sort: option(SORTS, params.get("sort")) ?? "popular",
      tool: option(TOOLS, params.get("tool")) ?? "",
      mode: option(MODES, params.get("mode")) ?? "",
      tag: params.get("tag") ?? "",
    }
    search = query.q

    const theme = params.get("theme")

    view = params.has("edit")
      ? { kind: "edit", slug: params.get("edit") || null }
      : theme
        ? { kind: "theme", slug: theme }
        : { kind: "list" }
  }

  const urlOf = (next: View) => {
    const params = new URLSearchParams()

    for (const key of KEYS) {
      if (query[key] !== BLANK[key]) {
        params.set(key, query[key])
      }
    }

    if (next.kind === "theme") {
      params.set("theme", next.slug)
    }

    if (next.kind === "edit") {
      params.set("edit", next.slug ?? "")
    }

    const text = params.toString()

    return text ? `?${text}` : location.pathname
  }

  const go = (next: View) => {
    view = next
    history.pushState(null, "", urlOf(next))
    scrollTo({ top: 0 })
  }

  const replaceTheme = (theme: CommunityTheme) => {
    themes = [theme, ...themes.filter(other => other.id !== theme.id)]
  }

  const count = async (theme: CommunityTheme) => {
    if (!live) {
      return
    }

    const downloads = await countDownload(theme.id).catch(() => null)

    if (downloads !== null) {
      replaceTheme({ ...theme, downloads })
    }
  }

  const apply = (theme: CommunityTheme) => {
    location.href = applyLink(theme)
    count(theme)
  }

  const copyJson = async (theme: CommunityTheme) => {
    await navigator.clipboard.writeText(`${JSON.stringify(theme.appearance, null, 2)}\n`)

    copiedId = theme.id
    setTimeout(() => {
      if (copiedId === theme.id) {
        copiedId = ""
      }
    }, COPIED_FOR)

    count(theme)
  }

  const like = async (theme: CommunityTheme) => {
    if (!account?.user || !live) {
      location.href = login

      return
    }

    const next = !liked.has(theme.id)
    const before = liked

    liked = new Set(before)

    if (next) {
      liked.add(theme.id)
    } else {
      liked.delete(theme.id)
    }

    replaceTheme({ ...theme, likes: theme.likes + (next ? 1 : -1) })

    try {
      await setLiked(theme.id, next)
    } catch {
      liked = before
      replaceTheme(theme)
    }
  }

  const removeTheme = async (theme: CommunityTheme) => {
    await remove(theme.id)
    themes = themes.filter(other => other.id !== theme.id)
    go({ kind: "list" })
  }

  const open = (e: MouseEvent, theme: CommunityTheme) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) {
      return
    }

    e.preventDefault()
    go({ kind: "theme", slug: theme.slug })
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
      history.replaceState(null, "", urlOf(view))
    }
  })

  onMount(() => {
    readUrl()
    ready = true
    account = webAccount()

    loadThemes().then(result => {
      themes = result.themes
      live = result.live

      if (live) {
        account?.reload().then(() => {
          if (account?.user) {
            loadLiked().then(set => (liked = set))
          }
        })
      }
    })

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

  {#if view.kind === "edit"}
    {#key current?.id}
      <Editor
        {t}
        {studio}
        theme={current}
        {account}
        {live}
        {login}
        onclose={() => go(current ? { kind: "theme", slug: current.slug } : { kind: "list" })}
        onsaved={saved => {
          replaceTheme(saved)
          go({ kind: "theme", slug: saved.slug })
        }}
      />
    {/key}
  {:else if view.kind === "theme" && current}
    <Detail
      {t}
      {studio}
      theme={current}
      liked={liked.has(current.id)}
      mine={!!account?.user && current.owner === account.user.id}
      copied={copiedId === current.id}
      onback={() => go({ kind: "list" })}
      onlike={() => like(current)}
      onapply={() => apply(current)}
      oncopy={() => copyJson(current)}
      onedit={() => go({ kind: "edit", slug: current.slug })}
      onremove={() => removeTheme(current)}
    />
  {:else}
    <section class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-2">
        <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">{t.title}</h1>
        <p class="max-w-2xl text-base-content/70">{t.lead}</p>
      </div>

      <button type="button" class="btn btn-primary" onclick={() => go({ kind: "edit", slug: null })}>
        <Icon icon="lucide:plus" class="size-4" />
        {t.create}
      </button>
    </section>

    <section class="flex flex-col gap-3" aria-label={t.search}>
      <div class="flex flex-wrap gap-2">
        <label class="input grow">
          <Icon icon="lucide:search" class="size-4 text-base-content/60" />
          <input type="search" placeholder={t.search} bind:value={search} />
        </label>

        <select class="select w-auto" aria-label={t.sortBy} bind:value={query.sort}>
          {#each SORTS as sort (sort)}
            <option value={sort}>{t.sorts[sort]}</option>
          {/each}
        </select>

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
              query = { ...BLANK, sort: query.sort }
            }}
          >
            {t.clear}
          </button>
        {/if}
      </div>

      {#if !live}
        <p class="text-sm text-base-content/60">{t.offline}</p>
      {/if}
    </section>

    {#if shown.length}
      <section class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {#each shown as theme (theme.id)}
          <a
            class="card group overflow-hidden border border-base-content/10 bg-base-200/60 transition-colors hover:border-primary/50"
            href={`?theme=${encodeURIComponent(theme.slug)}`}
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
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="truncate font-semibold">{theme.name}</h2>
                  <p class="truncate text-xs text-base-content/60">{t.by(theme.author)}</p>
                </div>

                <div class="flex shrink-0 items-center gap-3 text-xs text-base-content/60 tabular-nums">
                  <span class="flex items-center gap-1" title={t.likes}>
                    <Icon icon="lucide:heart" class={["size-3.5", liked.has(theme.id) && "text-secondary"]} />
                    {theme.likes}
                  </span>
                  <span class="flex items-center gap-1" title={t.downloads}>
                    <Icon icon="lucide:download" class="size-3.5" />
                    {theme.downloads}
                  </span>
                </div>
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
