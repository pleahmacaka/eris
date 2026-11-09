<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { Confirm, toast } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { formatBytes } from "../../format"
  import { randomToken, usageForget, usageScan } from "../../native"
  import {
    CATEGORIES,
    deleteItems,
    type Entry,
    type Folder,
    iconOf,
    isMedia,
    listFolder,
    newFolder,
    openFile,
    openWith,
    pasteItems,
    renameItem,
    requestStorage,
    type Sort,
    type SortKey,
    scanFiles,
    setClipboard,
    shareFiles,
    sortEntries,
    storageStats,
  } from "./mobile"
  import MobileThumb from "./MobileThumb.svelte"

  type Problem = "permission" | "restricted" | "failed"

  type Prompt = { kind: "newFolder" | "rename"; value: string; target: string }

  const SORT_KEY = "eris-files-mobile-sort"
  const HIDDEN_KEY = "eris-files-mobile-hidden"
  const SORTS: SortKey[] = ["name", "modified", "size"]
  const HOLD_MS = 420
  const SLOP = 10
  const EDGE = 64
  const STEP = 14

  const savedSort = (): Sort => {
    try {
      return JSON.parse(localStorage.getItem(SORT_KEY) ?? "") as Sort
    } catch {
      return { key: "name", descending: false }
    }
  }

  let home = $state(true)
  let path = $state<string | null>(null)
  let start = $state<Folder | null>(null)
  let stats = $state<Record<string, { total: number; free: number }>>({})
  let folder = $state<Folder | null>(null)
  let problem = $state<Problem | null>(null)
  let loading = $state(false)
  let reload = $state(0)
  let selected = $state<Set<string>>(new Set())
  let sort = $state<Sort>(savedSort())
  let showHidden = $state(localStorage.getItem(HIDDEN_KEY) === "1")
  let query = $state<string | null>(null)
  let clipboard = $state<{ items: string[]; cut: boolean } | null>(null)
  let busy = $state(false)
  let prompt = $state<Prompt | null>(null)
  let deleting = $state<string[] | null>(null)
  let details = $state<{ entries: Entry[]; size: number | null; files: number | null } | null>(
    null,
  )
  let sorting = $state(false)
  let visible = $state(true)
  let scroller = $state<HTMLElement>()
  let sequence = 0
  let press: { x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null
  let drag: { anchor: number; base: Set<string>; x: number; y: number } | null = null
  let held = false

  const locale = $derived(currentLocale())
  const dates = $derived(new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }))
  const selecting = $derived(selected.size > 0)

  const shown = $derived.by(() => {
    const needle = query?.trim().toLowerCase() ?? ""
    const entries = (folder?.entries ?? []).filter(
      entry =>
        (showHidden || !entry.name.startsWith(".")) &&
        (!needle || entry.name.toLowerCase().includes(needle)),
    )

    return sortEntries(entries, sort, locale)
  })

  const crumbs = $derived.by(() => {
    if (!folder) {
      return []
    }

    const rest = folder.path.slice(folder.root.length).split("/").filter(Boolean)
    const first = { name: rootName(folder.root), path: folder.root }

    return [
      first,
      ...rest.map((name, index) => ({
        name,
        path: `${folder?.root}/${rest.slice(0, index + 1).join("/")}`,
      })),
    ]
  })

  const rootName = (root: string) =>
    root === "/storage/emulated/0" ? $t("mobile.internal") : root.slice(root.lastIndexOf("/") + 1)

  const go = (next: string | null) => {
    selected = new Set()
    query = null
    home = next === null
    path = next
  }

  const refresh = () => {
    reload += 1
  }

  const fail = (reason: unknown) => {
    const code = String(reason)
    const key = `mobile.errors.${code}`
    const message = $t(key)

    toast(message === key ? $t("mobile.errors.failed") : message, "error")
  }

  export const back = () => {
    if (prompt || deleting || details || sorting) {
      prompt = null
      deleting = null
      details = null
      sorting = false

      return true
    }

    if (selecting) {
      selected = new Set()

      return true
    }

    if (query !== null) {
      query = null

      return true
    }

    if (home) {
      return false
    }

    go(folder?.parent ?? null)

    return true
  }

  const toggle = (entry: Entry) => {
    const next = new Set(selected)

    if (!next.delete(entry.path)) {
      next.add(entry.path)
    }

    selected = next
  }

  const tap = (entry: Entry) => {
    if (selecting) {
      toggle(entry)

      return
    }

    if (entry.dir) {
      go(entry.path)

      return
    }

    openFile(entry.path).catch(fail)
  }

  const extend = () => {
    if (!drag) {
      return
    }

    const row = document
      .elementFromPoint(drag.x, drag.y)
      ?.closest<HTMLElement>("[data-index]")

    if (!row) {
      return
    }

    const index = Number(row.dataset.index)
    const from = Math.min(drag.anchor, index)
    const to = Math.max(drag.anchor, index)

    selected = new Set([...drag.base, ...shown.slice(from, to + 1).map(entry => entry.path)])
  }

  const follow = () => {
    if (!drag || !scroller) {
      return
    }

    const box = scroller.getBoundingClientRect()

    if (drag.y < box.top + EDGE) {
      scroller.scrollTop -= STEP
      extend()
    } else if (drag.y > box.bottom - EDGE) {
      scroller.scrollTop += STEP
      extend()
    }

    requestAnimationFrame(follow)
  }

  const down = (e: PointerEvent, index: number) => {
    if (e.button !== 0) {
      return
    }

    const { clientX: x, clientY: y } = e

    clearTimeout(press?.timer)
    press = {
      x,
      y,
      timer: setTimeout(() => {
        press = null
        held = true
        drag = { anchor: index, base: new Set(selected), x, y }
        selected = new Set([...selected, shown[index].path])
        navigator.vibrate?.(15)
        requestAnimationFrame(follow)
      }, HOLD_MS),
    }
  }

  const move = (e: PointerEvent) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP) {
      clearTimeout(press.timer)
      press = null
    }

    if (drag) {
      drag.x = e.clientX
      drag.y = e.clientY
      extend()
    }
  }

  const up = () => {
    clearTimeout(press?.timer)
    press = null
    drag = null

    // the click that ends a long press lands after pointerup; a drag that left the row gets none
    if (held) {
      setTimeout(() => (held = false))
    }
  }

  const click = (entry: Entry) => {
    if (held) {
      held = false

      return
    }

    tap(entry)
  }

  const holdScroll = (node: HTMLElement) => {
    const block = (e: TouchEvent) => {
      if (drag) {
        e.preventDefault()
      }
    }

    node.addEventListener("touchmove", block, { passive: false })

    return () => node.removeEventListener("touchmove", block)
  }

  const chosen = () => [...selected]

  const focus = (field: HTMLInputElement) => {
    field.focus()
    field.select()
  }

  const focusName = (field: HTMLInputElement) => {
    const name = field.value
    const dot = name.lastIndexOf(".")
    const file = prompt?.kind === "rename" && !folder?.entries.find(entry => entry.path === prompt?.target)?.dir

    field.focus()
    field.setSelectionRange(0, file && dot > 0 ? dot : name.length)
  }

  const run = async (work: Promise<unknown>, touched: string[]) => {
    busy = true

    try {
      await work
      selected = new Set()

      return true
    } catch (reason) {
      fail(reason)

      return false
    } finally {
      scanFiles(touched)
      busy = false
      refresh()
    }
  }

  const stash = async (cut: boolean) => {
    const items = chosen()

    try {
      await setClipboard(items, cut)
      clipboard = { items, cut }
      selected = new Set()
    } catch (reason) {
      fail(reason)
    }
  }

  const paste = async () => {
    const pending = clipboard

    if (!folder || home || !pending || busy) {
      return
    }

    clipboard = null
    busy = true

    try {
      const landed = await pasteItems(folder.path)

      scanFiles([...landed, ...(pending.cut ? pending.items : [])])
      toast($t("mobile.pasted", { values: { count: landed.length } }), "success")
    } catch (reason) {
      if (pending.cut) {
        scanFiles(pending.items)
      }

      fail(reason)
    } finally {
      busy = false
      refresh()
    }
  }

  const submit = async () => {
    if (!prompt || !folder || busy) {
      return
    }

    const name = prompt.value.trim()
    const { kind, target } = prompt

    if (!name) {
      return
    }

    const renamed = `${target.slice(0, target.lastIndexOf("/"))}/${name}`
    const done =
      kind === "newFolder"
        ? await run(newFolder(folder.path, name), [])
        : await run(renameItem(target, name), [target, renamed])

    if (done) {
      prompt = null
    }
  }

  const startRename = () => {
    const [target] = chosen()
    const name = target.slice(target.lastIndexOf("/") + 1)

    prompt = { kind: "rename", value: name, target }
  }

  const measure = async (entry: Entry) => {
    if (!entry.dir) {
      return { size: entry.size, files: 1 }
    }

    const token = randomToken()
    const found = await usageScan(entry.path, token).finally(() => usageForget(token))

    return { size: found?.size ?? 0, files: found?.files ?? 0 }
  }

  const showDetails = async () => {
    const entries = shown.filter(entry => selected.has(entry.path))
    const opened = { entries, size: null, files: null }

    details = opened

    try {
      const measured = await Promise.all(entries.map(measure))

      if (details === opened) {
        details = {
          entries,
          size: measured.reduce((sum, part) => sum + part.size, 0),
          files: measured.reduce((sum, part) => sum + part.files, 0),
        }
      }
    } catch {
      return
    }
  }

  const pickSort = (key: SortKey) => {
    sort = { key, descending: sort.key === key ? !sort.descending : key !== "name" }
    localStorage.setItem(SORT_KEY, JSON.stringify(sort))
    sorting = false
  }

  const reloadNow = () => {
    sorting = false
    refresh()
  }

  const toggleHidden = () => {
    showHidden = !showHidden
    localStorage.setItem(HIDDEN_KEY, showHidden ? "1" : "0")
    sorting = false
  }

  $effect(() => {
    const track = () => {
      visible = document.visibilityState === "visible"
    }

    document.addEventListener("visibilitychange", track)

    return () => document.removeEventListener("visibilitychange", track)
  })

  $effect(() => {
    void reload

    if (!home || !visible) {
      return
    }

    listFolder(null)
      .then(found => {
        start = found
        problem = null

        for (const root of found.roots) {
          storageStats(root)
            .then(stat => {
              stats[root] = stat
            })
            .catch(() => undefined)
        }
      })
      .catch(reason => {
        problem = reason === "denied" ? "permission" : "failed"
      })
  })

  $effect(() => {
    const wanted = path

    void reload

    if (home || !visible || wanted === null) {
      return
    }

    const mine = ++sequence

    loading = true

    listFolder(wanted)
      .then(next => {
        if (mine === sequence) {
          folder = next
          problem = null
        }
      })
      .catch(reason => {
        if (mine !== sequence) {
          return
        }

        toast($t(reason === "denied" ? "mobile.restricted" : "mobile.errors.failed"), "error")
        go(folder && folder.path !== wanted ? folder.path : null)
      })
      .finally(() => {
        if (mine === sequence) {
          loading = false
        }
      })
  })
</script>

<div class="flex min-h-0 flex-1 flex-col">
  {#if selecting}
    <div class="flex min-h-14 items-center gap-1 border-b border-base-content/10 px-2">
      <button
        type="button"
        class="btn btn-ghost btn-square"
        aria-label={$t("mobile.clearSelection")}
        onclick={() => (selected = new Set())}
      >
        <Icon icon="lucide:x" class="size-5" />
      </button>

      <span class="flex-1 text-sm font-medium">
        {$t("mobile.selected", { values: { count: selected.size } })}
      </span>

      <button
        type="button"
        class="btn btn-ghost btn-sm"
        onclick={() => (selected = new Set(shown.map(entry => entry.path)))}
      >
        {$t("mobile.selectAll")}
      </button>
    </div>
  {:else if query !== null}
    <div class="flex min-h-14 items-center gap-2 border-b border-base-content/10 px-2">
      <button
        type="button"
        class="btn btn-ghost btn-square"
        aria-label={$t("mobile.closeSearch")}
        onclick={() => (query = null)}
      >
        <Icon icon="lucide:arrow-left" class="size-5" />
      </button>

      <input
        class="input input-sm flex-1"
        placeholder={$t("mobile.search")}
        bind:value={query}
        {@attach focus}
      />
    </div>
  {:else if home}
    <div class="flex min-h-14 items-center border-b border-base-content/10 px-4">
      <h1 class="text-lg font-semibold">{$t("mobile.title")}</h1>
    </div>
  {:else}
    <div class="flex min-h-14 items-center gap-1 border-b border-base-content/10 pl-2">
      <nav
        class="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        aria-label={$t("mobile.location")}
      >
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm shrink-0"
          aria-label={$t("mobile.title")}
          onclick={() => go(null)}
        >
          <Icon icon="lucide:house" class="size-4" />
        </button>

        {#each crumbs as crumb (crumb.path)}
          <Icon icon="lucide:chevron-right" class="size-4 shrink-0 text-base-content/40" />

          <button
            type="button"
            class={[
              "btn btn-ghost btn-sm shrink-0",
              crumb.path === folder?.path && "font-semibold",
            ]}
            onclick={() => go(crumb.path)}
          >
            {crumb.name}
          </button>
        {/each}
      </nav>

      <button
        type="button"
        class="btn btn-ghost btn-square"
        aria-label={$t("mobile.search")}
        onclick={() => (query = "")}
      >
        <Icon icon="lucide:search" class="size-5" />
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-square"
        aria-label={$t("mobile.sortTitle")}
        onclick={() => (sorting = true)}
      >
        <Icon icon="lucide:arrow-up-down" class="size-5" />
      </button>
    </div>
  {/if}

  <section class="min-h-0 flex-1 overflow-y-auto" bind:this={scroller} {@attach holdScroll}>
    {#if home && start && !problem}
      <div class="flex flex-col gap-6 p-4">
        <div class="grid grid-cols-3 gap-3">
          {#each CATEGORIES.filter(category => start?.entries.some(entry => entry.dir && entry.name === category.folder)) as category (category.folder)}
            <button
              type="button"
              class="flex min-h-24 flex-col items-center justify-center gap-2 rounded-box bg-base-200 active:bg-base-300"
              onclick={() => go(`${start?.root}/${category.folder}`)}
            >
              <span class={["flex size-11 items-center justify-center rounded-full", category.tone]}>
                <Icon icon={category.icon} class="size-6" />
              </span>
              <span class="text-sm">{$t(category.label)}</span>
            </button>
          {/each}
        </div>

        <div class="flex flex-col gap-2">
          <h2 class="text-sm font-semibold text-base-content/70">{$t("mobile.storage")}</h2>

          {#each start.roots as root (root)}
            {@const stat = stats[root]}

            <button
              type="button"
              class="flex min-h-16 items-center gap-3 rounded-box bg-base-200 px-4 py-3 text-left active:bg-base-300"
              onclick={() => go(root)}
            >
              <Icon
                icon={root === start.root ? "lucide:smartphone" : "lucide:sd-card"}
                class="size-6 shrink-0 text-primary"
              />

              <span class="flex min-w-0 flex-1 flex-col gap-1.5">
                <span class="flex items-baseline justify-between gap-2">
                  <span class="text-sm font-medium">{rootName(root)}</span>
                  {#if stat}
                    <span class="text-xs text-base-content/60 tabular-nums">
                      {$t("mobile.usage", {
                        values: {
                          used: formatBytes(stat.total - stat.free, locale),
                          total: formatBytes(stat.total, locale),
                        },
                      })}
                    </span>
                  {/if}
                </span>

                {#if stat}
                  <progress class="progress progress-primary h-1.5 w-full" value={stat.total - stat.free} max={stat.total}
                  ></progress>
                {/if}
              </span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if problem === "permission"}
      <div class="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm">
        <Icon icon="lucide:folder-lock" class="size-8 text-base-content/50" />
        <p class="text-base-content/70">{$t("share.storageDenied")}</p>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onclick={() => requestStorage().catch(fail)}
        >
          {$t("mobile.allowAccess")}
        </button>
      </div>
    {:else if problem === "failed"}
      <div class="flex flex-col items-center gap-3 py-12 text-sm text-base-content/60">
        <Icon icon="lucide:circle-alert" class="size-8" />
        {$t("mobile.errors.failed")}
        <button type="button" class="btn btn-sm" onclick={refresh}>{$t("mobile.retry")}</button>
      </div>
    {:else if !home && folder && shown.length === 0 && !loading}
      <p class="py-12 text-center text-sm text-base-content/60">
        {query ? $t("mobile.noMatches") : $t("share.filesEmpty")}
      </p>
    {/if}

    <ul class={["flex flex-col py-1", home && "hidden"]}>
      {#each shown as entry, index (entry.path)}
        {@const picked = selected.has(entry.path)}

        <li style="content-visibility: auto; contain-intrinsic-size: auto 3.5rem">
          <button
            type="button"
            data-index={index}
            class={[
              "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left select-none active:bg-base-content/10",
              picked && "bg-primary/15",
            ]}
            style="-webkit-touch-callout: none"
            onclick={() => click(entry)}
            oncontextmenu={e => e.preventDefault()}
            onpointerdown={e => down(e, index)}
            onpointermove={move}
            onpointerup={up}
            onpointercancel={up}
          >
            {#if selecting}
              <Icon
                icon={picked ? "lucide:circle-check" : "lucide:circle"}
                class={["size-5 shrink-0", picked ? "text-primary" : "text-base-content/40"]}
              />
            {/if}

            {#if !entry.dir && isMedia(entry.name)}
              <MobileThumb path={entry.path} modified={entry.modified} icon={iconOf(entry)} />
            {:else}
              <span class="flex size-10 shrink-0 items-center justify-center">
                <Icon icon={iconOf(entry)} class="size-8" />
              </span>
            {/if}

            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm">{entry.name}</span>
              <span class="flex gap-3 text-xs text-base-content/55 tabular-nums">
                {#if entry.modified}
                  <span>{dates.format(entry.modified)}</span>
                {/if}

                {#if !entry.dir}
                  <span>{formatBytes(entry.size, locale)}</span>
                {/if}
              </span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </section>

  {#if selecting}
    <div class="grid grid-cols-6 border-t border-base-content/10 pb-1">
      {#each [
        { icon: "lucide:copy", label: "mobile.copy", run: () => stash(false), single: false },
        { icon: "lucide:scissors", label: "mobile.move", run: () => stash(true), single: false },
        { icon: "lucide:pencil", label: "mobile.rename", run: startRename, single: true },
        { icon: "lucide:share-2", label: "mobile.share", run: () => shareFiles(chosen()).catch(fail), single: false, files: true },
        { icon: "lucide:info", label: "mobile.details", run: showDetails, single: false },
        { icon: "lucide:trash-2", label: "mobile.delete", run: () => (deleting = chosen()), single: false },
      ] as action (action.label)}
        <button
          type="button"
          class="flex min-h-14 flex-col items-center justify-center gap-1 text-xs active:bg-base-content/10 disabled:opacity-40"
          disabled={busy ||
            (action.single && selected.size !== 1) ||
            ("files" in action && shown.some(entry => entry.dir && selected.has(entry.path)))}
          onclick={action.run}
        >
          <Icon icon={action.icon} class="size-5" />
          {$t(action.label)}
        </button>
      {/each}
    </div>
  {:else if busy}
    <div class="flex min-h-14 items-center gap-3 border-t border-base-content/10 px-4 text-sm">
      <span class="loading loading-spinner loading-sm text-primary"></span>
      {$t("mobile.working")}
    </div>
  {:else if clipboard && !home}
    <div class="flex min-h-14 items-center gap-2 border-t border-base-content/10 px-4">
      <span class="flex-1 text-sm">
        {$t(clipboard.cut ? "mobile.moving" : "mobile.copying", { values: { count: clipboard.items.length } })}
      </span>
      <button type="button" class="btn btn-ghost btn-sm" onclick={() => (clipboard = null)}>
        {$t("mobile.cancel")}
      </button>
      <button type="button" class="btn btn-primary btn-sm" onclick={paste}>
        {$t("mobile.pasteHere")}
      </button>
    </div>
  {:else if folder && !home}
    <button
      type="button"
      class="btn btn-circle btn-primary btn-lg fixed right-5 bottom-24 shadow-lg"
      aria-label={$t("mobile.newFolder")}
      onclick={() => (prompt = { kind: "newFolder", value: "", target: "" })}
    >
      <Icon icon="lucide:folder-plus" class="size-6" />
    </button>
  {/if}
</div>

{#if prompt}
  <dialog class="modal modal-open modal-bottom">
    <form
      class="modal-box flex flex-col gap-3"
      onsubmit={e => {
        e.preventDefault()
        submit()
      }}
    >
      <h3 class="font-semibold">
        {$t(prompt.kind === "newFolder" ? "mobile.newFolder" : "mobile.rename")}
      </h3>
      <input class="input w-full" bind:value={prompt.value} {@attach focusName} />
      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" onclick={() => (prompt = null)}>
          {$t("mobile.cancel")}
        </button>
        <button type="submit" class="btn btn-primary">{$t("mobile.confirm")}</button>
      </div>
    </form>
  </dialog>
{/if}

{#if sorting}
  <dialog class="modal modal-open modal-bottom">
    <div class="modal-box flex flex-col gap-1">
      <h3 class="pb-2 font-semibold">{$t("mobile.sortTitle")}</h3>

      {#each SORTS as key (key)}
        <button type="button" class="btn btn-ghost min-h-12 justify-between" onclick={() => pickSort(key)}>
          {$t(`mobile.sort.${key}`)}
          {#if sort.key === key}
            <Icon icon={sort.descending ? "lucide:arrow-down" : "lucide:arrow-up"} class="size-4" />
          {/if}
        </button>
      {/each}

      <button type="button" class="btn btn-ghost min-h-12 justify-start" onclick={reloadNow}>
        <Icon icon="lucide:refresh-cw" class="size-4" />
        {$t("mobile.refresh")}
      </button>

      <label class="flex min-h-12 items-center justify-between px-4 text-sm">
        {$t("mobile.showHidden")}
        <input type="checkbox" class="toggle toggle-sm" checked={showHidden} onchange={toggleHidden} />
      </label>
    </div>
    <button type="button" class="modal-backdrop" aria-label={$t("mobile.cancel")} onclick={() => (sorting = false)}
    ></button>
  </dialog>
{/if}

{#if details}
  {@const [only] = details.entries.length === 1 ? details.entries : []}

  <dialog class="modal modal-open modal-bottom">
    <div class="modal-box flex flex-col gap-2 text-sm">
      <h3 class="font-semibold break-all">
        {only ? only.name : $t("mobile.selected", { values: { count: details.entries.length } })}
      </h3>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {#if only}
          <dt class="text-base-content/55">{$t("mobile.path")}</dt>
          <dd class="break-all select-text">{only.path}</dd>
        {/if}

        <dt class="text-base-content/55">{$t("mobile.size")}</dt>
        <dd class="tabular-nums">
          {details.size === null ? $t("mobile.measuring") : formatBytes(details.size, locale)}
        </dd>

        {#if details.files !== null && (!only || only.dir)}
          <dt class="text-base-content/55">{$t("mobile.contents")}</dt>
          <dd class="tabular-nums">{$t("mobile.fileCount", { values: { count: details.files } })}</dd>
        {/if}

        {#if only}
          <dt class="text-base-content/55">{$t("mobile.modified")}</dt>
          <dd>{dates.format(only.modified)}</dd>
        {/if}
      </dl>

      <div class="mt-2 flex gap-2">
        {#if only && !only.dir}
          <button type="button" class="btn flex-1" onclick={() => openWith(only.path).catch(fail)}>
            {$t("mobile.openWith")}
          </button>
        {/if}
        <button type="button" class="btn flex-1" onclick={() => (details = null)}>{$t("mobile.close")}</button>
      </div>
    </div>
  </dialog>
{/if}

<Confirm
  bind:open={
    () => deleting !== null,
    // Confirm clears `open` right before onconfirm runs, so dropping the list waits a tick
    next => !next && queueMicrotask(() => (deleting = null))
  }
  title={$t("mobile.deleteTitle")}
  body={deleting?.length === 1
    ? $t("mobile.deleteOne", { values: { name: deleting[0].slice(deleting[0].lastIndexOf("/") + 1) } })
    : $t("mobile.deleteBody", { values: { count: deleting?.length ?? 0 } })}
  action={$t("mobile.delete")}
  onconfirm={() => {
    const items = deleting ?? []

    deleting = null
    run(deleteItems(items), items)
  }}
/>
