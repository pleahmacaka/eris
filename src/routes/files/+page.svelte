<script lang="ts">
  import Icon from "@iconify/svelte"
  import * as native from "$lib/native"
  import type { FileEntry, FilePlace } from "$lib/native"
  import ContextMenu from "$lib/ui/ContextMenu.svelte"
  import type { MenuItem } from "$lib/ui/menu"

  type Sort = "name" | "modified" | "size"

  let places = $state<FilePlace[]>([])
  let entries = $state<FileEntry[]>([])
  let path = $state("")
  let parent = $state<string | null>(null)
  let error = $state("")
  let loading = $state(false)

  let history = $state<string[]>([])
  let cursor = $state(-1)

  let selection = $state(new Set<string>())
  let anchor = $state<string | null>(null)
  let renaming = $state<string | null>(null)
  let draft = $state("")
  let clipboard = $state<{ paths: string[]; cut: boolean } | null>(null)

  let filter = $state("")
  let deep = $state<FileEntry[] | null>(null)
  let sort = $state<Sort>("name")
  let ascending = $state(true)
  let showHidden = $state(false)

  let menuOpen = $state(false)
  let menuX = $state(0)
  let menuY = $state(0)

  const icon = (entry: FileEntry) =>
    entry.directory ? "lucide:folder" : "lucide:file"

  const listed = $derived.by(() => {
    const source = deep ?? entries
    const needle = filter.trim().toLowerCase()
    const rows = source.filter(
      entry =>
        (showHidden || !entry.hidden) &&
        (deep !== null || !needle || entry.name.toLowerCase().includes(needle)),
    )

    const direction = ascending ? 1 : -1

    return [...rows].sort((a, b) => {
      if (a.directory !== b.directory) {
        return a.directory ? -1 : 1
      }

      if (sort === "size") {
        return (a.size - b.size) * direction
      }

      if (sort === "modified") {
        return (a.modified - b.modified) * direction
      }

      return a.name.localeCompare(b.name) * direction
    })
  })

  const crumbs = $derived.by(() => {
    const parts = path.split("\\").filter(Boolean)

    return parts.map((name, index) => ({
      name,
      path: `${parts.slice(0, index + 1).join("\\")}${index === 0 ? "\\" : ""}`,
    }))
  })

  const size = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`
    }

    const units = ["KB", "MB", "GB", "TB"]
    let value = bytes / 1024
    let unit = 0

    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024
      unit += 1
    }

    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
  }

  const when = (stamp: number) =>
    stamp
      ? new Date(stamp).toLocaleString(undefined, {
          dateStyle: "short",
          timeStyle: "short",
        })
      : ""

  const load = async (next: string, record = true) => {
    loading = true

    try {
      const listing = await native.listDir(next)

      entries = listing.entries
      path = listing.path
      parent = listing.parent
      error = ""
      selection = new Set()
      deep = null
      filter = ""

      if (record) {
        history = [...history.slice(0, cursor + 1), listing.path]
        cursor = history.length - 1
      }
    } catch (reason) {
      error = String(reason)
    } finally {
      loading = false
    }
  }

  const refresh = () => load(path, false)

  const back = () => {
    if (cursor > 0) {
      cursor -= 1
      load(history[cursor], false)
    }
  }

  const forward = () => {
    if (cursor < history.length - 1) {
      cursor += 1
      load(history[cursor], false)
    }
  }

  const up = () => {
    if (parent) {
      load(parent)
    }
  }

  const open = (entry: FileEntry) => {
    if (entry.directory) {
      return load(entry.path)
    }

    return native.launchApp(entry.path).catch(() => undefined)
  }

  const pick = (entry: FileEntry, e: MouseEvent) => {
    const next = new Set(selection)

    if (e.shiftKey && anchor) {
      const from = listed.findIndex(row => row.path === anchor)
      const to = listed.findIndex(row => row.path === entry.path)

      if (from >= 0 && to >= 0) {
        next.clear()

        for (const row of listed.slice(Math.min(from, to), Math.max(from, to) + 1)) {
          next.add(row.path)
        }
      }
    } else if (e.ctrlKey) {
      if (next.has(entry.path)) {
        next.delete(entry.path)
      } else {
        next.add(entry.path)
      }

      anchor = entry.path
    } else {
      next.clear()
      next.add(entry.path)
      anchor = entry.path
    }

    selection = next
  }

  const selected = $derived(listed.filter(entry => selection.has(entry.path)))

  const startRename = (entry: FileEntry) => {
    renaming = entry.path
    draft = entry.name
  }

  const commitRename = async () => {
    const target = renaming
    const name = draft.trim()

    renaming = null

    if (!target || !name) {
      return
    }

    await native.renameEntry(target, name).catch(reason => {
      error = String(reason)
    })

    refresh()
  }

  const remove = async (permanent: boolean) => {
    const paths = selected.map(entry => entry.path)

    if (paths.length === 0) {
      return
    }

    await native.deleteEntries(paths, permanent).catch(reason => {
      error = String(reason)
    })

    refresh()
  }

  const copy = (cut: boolean) => {
    const paths = selected.map(entry => entry.path)

    if (paths.length > 0) {
      clipboard = { paths, cut }
    }
  }

  const paste = async () => {
    if (!clipboard) {
      return
    }

    await native
      .transferEntries(clipboard.paths, path, clipboard.cut)
      .catch(reason => {
        error = String(reason)
      })

    if (clipboard.cut) {
      clipboard = null
    }

    refresh()
  }

  const newFolder = async () => {
    const created = await native.createFolder(path, "New folder").catch(reason => {
      error = String(reason)

      return null
    })

    await refresh()

    if (created) {
      selection = new Set([created])
      renaming = created
      draft = created.split("\\").pop() ?? ""
    }
  }

  const runSearch = async () => {
    const query = filter.trim()

    if (!query) {
      deep = null

      return
    }

    loading = true
    deep = await native.searchDir(path, query).catch(() => [])
    loading = false
  }

  const menuItems = $derived.by((): MenuItem[] => {
    const target = selected[0]

    if (!target) {
      return [
        {
          label: "새 폴더",
          icon: "lucide:folder-plus",
          action: newFolder,
        },
        {
          label: "붙여넣기",
          icon: "lucide:clipboard",
          action: paste,
          disabled: !clipboard,
        },
        { label: "새로 고침", icon: "lucide:refresh-cw", action: refresh },
      ]
    }

    return [
      { label: "열기", icon: "lucide:external-link", action: () => open(target) },
      {
        label: "이름 바꾸기",
        icon: "lucide:pencil",
        action: () => startRename(target),
      },
      { label: "복사", icon: "lucide:copy", action: () => copy(false) },
      { label: "잘라내기", icon: "lucide:scissors", action: () => copy(true) },
      {
        label: "경로 복사",
        icon: "lucide:link",
        action: () => navigator.clipboard.writeText(target.path),
      },
      { label: "삭제", icon: "lucide:trash-2", action: () => remove(false) },
    ]
  })

  const onkeydown = (e: KeyboardEvent) => {
    const typing = (e.target as HTMLElement | null)?.closest("input, textarea")

    if (renaming || typing) {
      return
    }

    if (e.key === "Escape") {
      selection = new Set()

      return
    }

    if (e.key === "Backspace") {
      up()

      return
    }

    if (e.key === "F2" && selected[0]) {
      startRename(selected[0])

      return
    }

    if (e.key === "Delete") {
      remove(e.shiftKey)

      return
    }

    if (e.key === "F5") {
      refresh()

      return
    }

    if (e.ctrlKey && e.key === "c") {
      copy(false)

      return
    }

    if (e.ctrlKey && e.key === "x") {
      copy(true)

      return
    }

    if (e.ctrlKey && e.key === "v") {
      paste()

      return
    }

    if (e.ctrlKey && e.key === "a") {
      e.preventDefault()
      selection = new Set(listed.map(entry => entry.path))

      return
    }

    if (e.key === "Enter" && selected[0]) {
      open(selected[0])

      return
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()

      const step = e.key === "ArrowDown" ? 1 : -1
      const index = listed.findIndex(entry => entry.path === anchor)
      const next = listed[Math.min(Math.max(0, index + step), listed.length - 1)]

      if (next) {
        anchor = next.path
        selection = new Set([next.path])
      }
    }
  }

  $effect(() => {
    native
      .filePlaces()
      .then(list => {
        places = list

        if (!path && list[0]) {
          load(list[0].path)
        }
      })
      .catch(() => undefined)
  })
</script>

<svelte:window {onkeydown} />

<main class="flex h-full min-h-0 select-none flex-col">
  <header
    data-tauri-drag-region
    class="flex shrink-0 items-center gap-1 border-b border-base-content/10 px-2 py-1.5"
  >
    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="Back"
      disabled={cursor <= 0}
      onclick={back}
    >
      <Icon icon="lucide:arrow-left" class="size-4" />
    </button>

    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="Forward"
      disabled={cursor >= history.length - 1}
      onclick={forward}
    >
      <Icon icon="lucide:arrow-right" class="size-4" />
    </button>

    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="Up"
      disabled={!parent}
      onclick={up}
    >
      <Icon icon="lucide:arrow-up" class="size-4" />
    </button>

    <button class="btn btn-ghost btn-square btn-sm" aria-label="Refresh" onclick={refresh}>
      <Icon icon="lucide:refresh-cw" class="size-4" />
    </button>

    <nav
      class="mx-1 flex min-w-0 grow items-center gap-0.5 overflow-x-auto rounded-field bg-base-content/5 px-2 py-1 text-sm"
      aria-label="Path"
    >
      {#each crumbs as crumb, index (crumb.path)}
        {#if index > 0}
          <Icon icon="lucide:chevron-right" class="size-3 shrink-0 opacity-40" />
        {/if}

        <button
          class="shrink-0 rounded px-1 hover:bg-base-content/10"
          onclick={() => load(crumb.path)}
        >
          {crumb.name}
        </button>
      {/each}
    </nav>

    <label class="input input-sm w-56 shrink-0 gap-2">
      <Icon icon="lucide:search" class="size-4 opacity-60" />

      <input
        bind:value={filter}
        onkeydown={e => e.key === "Enter" && runSearch()}
        type="text"
        placeholder="이 폴더에서 검색"
        class="grow"
      />
    </label>

    <button
      class={["btn btn-ghost btn-square btn-sm", showHidden && "text-primary"]}
      aria-label="Toggle hidden files"
      title="숨김 항목"
      aria-pressed={showHidden}
      onclick={() => (showHidden = !showHidden)}
    >
      <Icon icon={showHidden ? "lucide:eye" : "lucide:eye-off"} class="size-4" />
    </button>

    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="Close"
      onclick={() => native.hideWindow("files")}
    >
      <Icon icon="lucide:x" class="size-4" />
    </button>
  </header>

  <div class="flex min-h-0 grow">
    <aside class="w-52 shrink-0 overflow-y-auto border-r border-base-content/10 p-2">
      {#each places as place (place.path)}
        <button
          class={[
            "flex w-full items-center gap-2 rounded-field px-2 py-1.5 text-left text-sm hover:bg-base-content/10",
            path === place.path && "bg-base-content/10",
          ]}
          onclick={() => load(place.path)}
        >
          <Icon
            icon={place.kind === "drive" ? "lucide:hard-drive" : "lucide:folder"}
            class="size-4 shrink-0 opacity-70"
          />

          <span class="min-w-0 grow truncate">{place.name}</span>
        </button>

        {#if place.kind === "drive" && place.total > 0}
          <div class="mb-1 px-2">
            <progress
              class="progress progress-primary h-1"
              value={place.total - place.free}
              max={place.total}
            ></progress>
          </div>
        {/if}
      {/each}
    </aside>

    <section
      role="application"
      aria-label="Files"
      class="relative flex min-w-0 grow flex-col"
      oncontextmenu={e => {
        e.preventDefault()
        menuX = e.clientX
        menuY = e.clientY
        menuOpen = true
      }}
    >
      <div
        class="flex shrink-0 items-center gap-2 border-b border-base-content/10 px-3 py-1 text-xs text-base-content/50"
      >
        <button
          class="w-full max-w-none grow text-left"
          onclick={() => {
            ascending = sort === "name" ? !ascending : true
            sort = "name"
          }}
        >
          이름
        </button>

        <button
          class="w-40 shrink-0 text-left"
          onclick={() => {
            ascending = sort === "modified" ? !ascending : false
            sort = "modified"
          }}
        >
          수정한 날짜
        </button>

        <button
          class="w-24 shrink-0 text-right"
          onclick={() => {
            ascending = sort === "size" ? !ascending : false
            sort = "size"
          }}
        >
          크기
        </button>
      </div>

      <div class="min-h-0 grow overflow-y-auto">
        {#if error}
          <p class="p-6 text-sm text-error">{error}</p>
        {:else if loading && listed.length === 0}
          <p class="p-6 text-sm text-base-content/50">불러오는 중</p>
        {:else}
          {#each listed as entry (entry.path)}
            <div
              role="row"
              tabindex="-1"
              class={[
                "flex items-center gap-2 px-3 py-1 text-sm",
                selection.has(entry.path)
                  ? "bg-primary/15"
                  : "hover:bg-base-content/5",
                entry.hidden && "opacity-50",
              ]}
              onclick={e => pick(entry, e)}
              oncontextmenu={e => {
                if (!selection.has(entry.path)) {
                  pick(entry, e)
                }
              }}
              ondblclick={() => open(entry)}
              onkeydown={() => undefined}
            >
              <Icon
                icon={icon(entry)}
                class={[
                  "size-4 shrink-0",
                  entry.directory ? "text-primary/80" : "opacity-60",
                ]}
              />

              {#if renaming === entry.path}
                <input
                  bind:value={draft}
                  onblur={commitRename}
                  onkeydown={e => {
                    if (e.key === "Enter") {
                      commitRename()
                    }

                    if (e.key === "Escape") {
                      renaming = null
                    }
                  }}
                  class="input input-xs grow"
                />
              {:else}
                <span class="min-w-0 grow truncate">{entry.name}</span>
              {/if}

              <span class="w-40 shrink-0 text-xs text-base-content/50">
                {when(entry.modified)}
              </span>

              <span class="w-24 shrink-0 text-right text-xs text-base-content/50">
                {entry.directory ? "" : size(entry.size)}
              </span>
            </div>
          {:else}
            <p class="p-6 text-sm text-base-content/50">비어 있습니다</p>
          {/each}
        {/if}
      </div>

      <footer
        class="flex shrink-0 items-center justify-between border-t border-base-content/10 px-3 py-1 text-xs text-base-content/50"
      >
        <span>{listed.length}개 항목</span>

        {#if selection.size > 0}
          <span>{selection.size}개 선택</span>
        {/if}
      </footer>

      <ContextMenu
        bind:open={menuOpen}
        items={menuItems}
        x={menuX}
        y={menuY}
        placement="down"
        label="File menu"
      />
    </section>
  </div>
</main>
