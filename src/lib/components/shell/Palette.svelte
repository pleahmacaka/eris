<script lang="ts">
  import Icon from "@iconify/svelte"
  import { isCanvas, stem } from "$lib/vault/paths"
  import { type Command, commands, currentFolder } from "$lib/workspace/commands"
  import { layout } from "$lib/workspace/layout.svelte"
  import { filePaths, openPath } from "$lib/workspace/navigate"
  import {
    insertTemplate,
    newFromTemplate,
    templateFiles,
  } from "$lib/workspace/templates"

  type Item = {
    key: string
    label: string
    detail?: string
    icon: string
    keys?: string
    run: (newTab: boolean) => unknown
  }

  const LIMIT = 60

  let dialog: HTMLDialogElement
  let query = $state("")
  let cursor = $state(0)
  let templates = $state<string[]>([])

  const mode = $derived(layout.palette)

  const placeholder = $derived(
    mode === "commands"
      ? "명령 검색"
      : mode === "files"
        ? "파일 이름 검색"
        : "템플릿 검색",
  )

  const fromCommand = (command: Command): Item => ({
    key: command.id,
    label: command.label,
    icon: command.icon,
    keys: command.keys,
    run: () => command.run(),
  })

  const fromPath = (path: string, run: (newTab: boolean) => unknown): Item => ({
    key: path,
    label: stem(path),
    detail: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : undefined,
    icon: isCanvas(path) ? "lucide:layout-dashboard" : "lucide:file-text",
    run,
  })

  const source = $derived.by((): Item[] => {
    if (mode === "commands") {
      return commands().map(fromCommand)
    }

    if (mode === "files") {
      return filePaths().map(path =>
        fromPath(path, newTab => openPath(path, { newTab })),
      )
    }

    if (mode === "insert-template") {
      return templates.map(path => fromPath(path, () => insertTemplate(path)))
    }

    if (mode === "new-template") {
      const folder = currentFolder()

      return templates.map(path =>
        fromPath(path, () => newFromTemplate(path, folder)),
      )
    }

    return []
  })

  const items = $derived.by(() => {
    const needle = query.trim().toLocaleLowerCase()

    return source
      .filter(
        item =>
          needle === "" ||
          item.label.toLocaleLowerCase().includes(needle) ||
          item.detail?.toLocaleLowerCase().includes(needle),
      )
      .slice(0, LIMIT)
  })

  let shown: typeof mode = null

  $effect(() => {
    const next = mode

    if (next === shown) {
      return
    }

    shown = next

    if (!next) {
      dialog.close()

      return
    }

    query = ""
    cursor = 0
    templates = []

    if (next === "insert-template" || next === "new-template") {
      templateFiles().then(found => (templates = found))
    }

    if (!dialog.open) {
      dialog.showModal()
    }
  })

  const choose = (item: Item | undefined, newTab = false) => {
    if (!item) {
      return
    }

    layout.palette = null
    Promise.resolve(item.run(newTab)).catch(() => undefined)
  }

  const keydown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      cursor = Math.min(cursor + 1, items.length - 1)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      cursor = Math.max(cursor - 1, 0)
    } else if (event.key === "Enter") {
      event.preventDefault()
      choose(items[cursor], event.ctrlKey || event.metaKey)
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="modal modal-top"
  onclose={() => (layout.palette = null)}
>
  <div
    class={[
      "modal-box mx-auto mt-16 w-full max-w-xl border border-base-content/10",
      "p-0",
    ]}
  >
    <label class="input w-full border-0 border-b border-base-content/10">
      <Icon icon="lucide:search" class="size-4 opacity-50" />
      <input
        class="grow"
        {placeholder}
        bind:value={query}
        oninput={() => (cursor = 0)}
        onkeydown={keydown}
      />
    </label>

    <ul class="max-h-96 overflow-y-auto py-1" role="listbox">
      {#if items.length === 0}
        <li class="px-4 py-6 text-center text-sm text-base-content/50">
          {mode === "insert-template" || mode === "new-template"
            ? "템플릿 없음"
            : "결과 없음"}
        </li>
      {/if}

      {#each items as item, i (item.key)}
        <li role="option" aria-selected={i === cursor}>
          <button
            class={[
              "flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left",
              "text-sm",
              i === cursor ? "bg-primary/15" : "hover:bg-base-content/5",
            ]}
            onpointermove={() => (cursor = i)}
            onclick={e => choose(item, e.ctrlKey || e.metaKey)}
          >
            <Icon icon={item.icon} class="size-4 shrink-0 opacity-60" />
            <span class="min-w-0 flex-1 truncate">{item.label}</span>
            {#if item.detail}
              <span class="truncate text-xs text-base-content/45">
                {item.detail}
              </span>
            {/if}
            {#if item.keys}
              <kbd class="kbd kbd-sm shrink-0">{item.keys}</kbd>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button aria-label="닫기">닫기</button>
  </form>
</dialog>
