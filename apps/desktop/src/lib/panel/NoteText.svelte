<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { NoteLink } from "@eris/settings"
  import { rootRem } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { noteLinkable, notePreview, openUrl } from "#lib/native/index.js"
  import { openWithIntent } from "#lib/native/windows.js"

  const EXCERPT_LINES = 14
  const GAP = 0.5
  const WIDTH = 20
  const HEIGHT = 16.25

  type Hover = { path: string; title: string; left: number; top: number }

  let { text, link }: { text: string; link: NoteLink } = $props()

  let linkable = $state(false)
  let hover = $state<Hover | null>(null)
  let previews = $state<Record<string, string | null>>({})

  let markdown = $state<typeof import("@eris/markdown")>()

  $effect(() => {
    import("@eris/markdown").then(module => (markdown = module))
  })

  const html = $derived(markdown?.renderMarkdown(text) ?? "")

  const references = $derived(linkable && link.enabled && link.references)

  $effect(() => {
    noteLinkable()
      .then(value => (linkable = value))
      .catch(() => undefined)
  })

  const load = (path: string) => {
    if (path in previews) {
      return
    }

    previews[path] = null
    notePreview(path)
      .then(text => (previews[path] = markdown?.withoutFrontmatter(text) ?? text))
      .catch(() => (previews[path] = ""))
  }

  const excerpt = (markdown: string) =>
    markdown.split("\n").slice(0, EXCERPT_LINES).join("\n")

  const citeAt = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLAnchorElement>("a.note-cite") : null

  const show = (cite: HTMLAnchorElement) => {
    const path = cite.dataset.notePath

    if (!references || !link.preview || !path) {
      return
    }

    const rem = rootRem()
    const box = cite.getBoundingClientRect()
    const left = box.left / rem
    const top = box.top / rem
    const bottom = box.bottom / rem
    const below = bottom + GAP + HEIGHT <= innerHeight / rem

    load(path)
    hover = {
      path,
      title: cite.textContent ?? path,
      left: Math.max(GAP, Math.min(left, innerWidth / rem - WIDTH - GAP)),
      top: below ? bottom + GAP : Math.max(GAP, top - GAP - HEIGHT),
    }
  }

  const onpointerover = (e: PointerEvent) => {
    const cite = citeAt(e.target)

    if (cite) {
      show(cite)
    }
  }

  const onpointerout = (e: PointerEvent) => {
    if (citeAt(e.target) && !citeAt(e.relatedTarget)) {
      hover = null
    }
  }

  const onclick = (e: MouseEvent) => {
    const anchor = e.target instanceof Element ? e.target.closest("a") : null

    if (!anchor) {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    const path = anchor.dataset.notePath

    if (path) {
      hover = null

      if (references) {
        openWithIntent("note", JSON.stringify({ path, title: anchor.textContent ?? path })).catch(
          () => undefined,
        )
      }
    } else if (anchor.hasAttribute("data-external")) {
      openUrl(anchor.href).catch(() => undefined)
    }
  }
</script>

<div
  role="presentation"
  class={[
    "markdown text-sm text-base-content/85",
    !references && [
      "[&_a.note-cite]:pointer-events-none [&_a.note-cite]:p-0!",
      "[&_a.note-cite]:bg-transparent! [&_a.note-cite]:text-inherit!",
    ],
  ]}
  {onclick}
  {onpointerover}
  {onpointerout}
>
  {@html html}
</div>

{#if hover}
  {@const preview = previews[hover.path]}

  <section
    role="tooltip"
    class={[
      "eris-card pointer-events-none fixed z-50 flex w-80 max-h-65 flex-col",
      "gap-2 overflow-hidden p-3",
    ]}
    style:left="{hover.left}rem"
    style:top="{hover.top}rem"
  >
    <header class="flex items-center gap-2">
      <Icon icon="lucide:file-text" class="size-4 shrink-0 text-primary" />

      <h4 class="min-w-0 grow truncate text-sm font-semibold">{hover.title}</h4>
    </header>

    {#if preview === null}
      <span class="loading loading-dots loading-sm text-base-content/50"></span>
    {:else if preview}
      <div class="markdown min-h-0 overflow-hidden text-xs text-base-content/75">
        {@html markdown?.renderMarkdown(excerpt(preview)) ?? ""}
      </div>
    {:else}
      <p class="text-xs text-base-content/50">{$t("panel.event.previewMissing")}</p>
    {/if}
  </section>
{/if}
