<script lang="ts">
  import type { EditorView } from "@codemirror/view"
  import Icon from "@iconify/svelte"
  import { onMount } from "svelte"
  import { editors } from "$lib/editor/registry"
  import { createEditor, replaceDoc } from "$lib/editor/setup"
  import { stem } from "$lib/vault/paths"
  import {
    onVaultChange,
    readFile,
    renamePath,
    saveFile,
    texts,
  } from "$lib/vault/vault.svelte"
  import { filePaths, openLink } from "$lib/workspace/navigate"
  import { retarget } from "$lib/workspace/workspace.svelte"
  import ReadingView from "./ReadingView.svelte"

  const { tabId, path }: { tabId: string; path: string } = $props()

  const SAVE_DELAY = 400

  let host: HTMLDivElement
  let view: EditorView | null = null
  let text = $state("")
  let loaded = $state(false)
  let reading = $state(false)
  let failure = $state("")
  let pending: ReturnType<typeof setTimeout> | undefined

  const fail = (error: unknown) => {
    failure = error instanceof Error ? error.message : String(error)
  }

  const flush = async () => {
    if (pending === undefined) {
      return
    }

    clearTimeout(pending)
    pending = undefined
    await saveFile(path, text).catch(fail)
  }

  const changed = (next: string) => {
    text = next

    if (next === texts.get(path)) {
      return
    }

    clearTimeout(pending)
    pending = setTimeout(flush, SAVE_DELAY)
  }

  const rename = async (name: string) => {
    if (name.trim() === "" || name === stem(path)) {
      return
    }

    try {
      await flush()
      retarget(path, await renamePath(path, name))
    } catch (error) {
      fail(error)
    }
  }

  onMount(() => {
    let disposed = false

    readFile(path)
      .then(initial => {
        if (disposed) {
          return
        }

        text = initial
        loaded = true
        view = createEditor({
          parent: host,
          doc: initial,
          paths: filePaths,
          onChange: changed,
          onLink: (target, newTab) => {
            openLink(target, path, newTab).catch(fail)
          },
        })
        editors.set(tabId, view)
      })
      .catch(fail)

    const stop = onVaultChange(change => {
      if (!change.external || pending !== undefined || !view) {
        return
      }

      const next = texts.get(path)

      if (change.paths.includes(path) && next !== undefined && next !== text) {
        text = next
        replaceDoc(view, next)
      }
    })

    return () => {
      disposed = true
      stop()
      flush()
      editors.delete(tabId)
      view?.destroy()
    }
  })
</script>

<div class="flex min-h-0 flex-1 flex-col bg-base-100">
  <div class="mx-auto flex w-full max-w-184 items-center gap-2 px-6 pt-5">
    <input
      class={[
        "min-w-0 flex-1 bg-transparent text-2xl font-bold tracking-tight",
        "outline-none placeholder:text-base-content/30",
      ]}
      value={stem(path)}
      placeholder="제목 없음"
      aria-label="노트 제목"
      onchange={e => rename(e.currentTarget.value)}
      onkeydown={e => {
        if (e.key === "Enter") {
          e.currentTarget.blur()
        }
      }}
    />

    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label={reading ? "편집 모드" : "읽기 모드"}
      title={reading ? "편집 모드" : "읽기 모드"}
      onclick={() => (reading = !reading)}
    >
      <Icon
        icon={reading ? "lucide:pencil-line" : "lucide:book-open"}
        class="size-4"
      />
    </button>
  </div>

  {#if failure}
    <p class="mx-auto w-full max-w-184 px-6 pt-2 text-xs text-error">
      {failure}
    </p>
  {/if}

  <div class="relative min-h-0 flex-1">
    <div
      bind:this={host}
      class={["absolute inset-0 overflow-hidden", reading && "invisible"]}
    ></div>

    {#if reading && loaded}
      <div class="absolute inset-0 overflow-y-auto bg-base-100">
        <ReadingView {text} {path} />
      </div>
    {/if}
  </div>
</div>
