<script lang="ts">
  import Icon from "@iconify/svelte"
  import { noteUrl } from "@eris/bridge"
  import { renderMarkdown, withoutFrontmatter } from "@eris/markdown"
  import { t } from "svelte-i18n"
  import * as native from "$lib/native"
  import { onWindowShown, takeIntent } from "$lib/native/windows"

  type Shown = { path: string; title: string }

  document.documentElement.dataset.surface = "window"

  let shown = $state<Shown | null>(null)
  let html = $state<string | null>(null)
  let missing = $state(false)

  const open = async (next: Shown) => {
    shown = next
    html = null
    missing = false

    try {
      html = renderMarkdown(withoutFrontmatter(await native.notePreview(next.path)))
    } catch {
      missing = true
    }
  }

  const take = () =>
    takeIntent("note")
      .then(intent => {
        if (intent) {
          open(JSON.parse(intent))
        }
      })
      .catch(() => undefined)

  const close = () => native.hideWindow("note").catch(() => undefined)

  const openInNote = () => {
    if (shown) {
      native.openUrl(noteUrl(shown.path)).catch(() => undefined)
    }
  }

  const onclick = (e: MouseEvent) => {
    const anchor = (e.target as Element).closest("a")

    if (!anchor) {
      return
    }

    e.preventDefault()

    const path = anchor.dataset.notePath

    if (path) {
      open({ path, title: anchor.textContent ?? path })
    } else if (anchor.hasAttribute("data-external")) {
      native.openUrl(anchor.href).catch(() => undefined)
    }
  }

  $effect(() => {
    take()

    const stop = onWindowShown("note", take)

    return () => {
      stop.then(off => off())
    }
  })
</script>

<svelte:window onkeydown={e => e.key === "Escape" && close()} />

<main class="flex min-h-0 grow flex-col">
  <header
    data-tauri-drag-region
    class="flex h-11 shrink-0 items-center gap-2 border-b border-base-content/10 pr-2 pl-4"
  >
    <Icon icon="lucide:file-text" class="pointer-events-none size-4 shrink-0 text-primary" />

    <h1 data-tauri-drag-region class="min-w-0 grow truncate text-sm font-semibold">
      {shown?.title ?? ""}
    </h1>

    <button
      type="button"
      class="btn btn-ghost btn-sm gap-1.5"
      disabled={!shown}
      onclick={openInNote}
    >
      {$t("panel.event.openInNote")}
      <Icon icon="lucide:arrow-up-right" class="size-4" />
    </button>

    <button
      type="button"
      class="btn btn-ghost btn-circle btn-sm"
      aria-label={$t("common.close")}
      onclick={close}
    >
      <Icon icon="lucide:x" class="size-4" />
    </button>
  </header>

  <div class="min-h-0 grow overflow-y-auto px-6 py-5">
    {#if missing}
      <p class="text-sm text-base-content/50">{$t("panel.event.previewMissing")}</p>
    {:else if html === null}
      <span class="loading loading-dots loading-sm text-base-content/50"></span>
    {:else if !html}
      <p class="text-sm text-base-content/50">{$t("panel.event.noteEmpty")}</p>
    {:else}
      <article role="presentation" class="markdown text-sm" {onclick}>
        {@html html}
      </article>
    {/if}
  </div>
</main>
