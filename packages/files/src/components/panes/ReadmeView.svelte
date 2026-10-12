<script lang="ts">
  import "@eris/markdown/markdown.css"
  import { renderMarkdown, withoutFrontmatter } from "@eris/markdown"
  import { extensionOf } from "../../locations"
  import { previewText, runAddress } from "../../native"

  let { path, name, raw }: { path: string; name: string; raw: boolean } =
    $props()

  let text = $state<string | null>(null)

  const markdown = $derived([".md", ".markdown", ""].includes(extensionOf(name)))

  $effect(() => {
    const target = path
    let live = true

    text = null
    previewText(target)
      .catch(() => "")
      .then(value => {
        if (live) {
          text = value
        }
      })

    return () => {
      live = false
    }
  })

  const follow = (e: MouseEvent) => {
    const link = e.target instanceof Element ? e.target.closest("a") : null

    if (!link) {
      return
    }

    e.preventDefault()

    const href = link.getAttribute("href") ?? ""

    if (href.startsWith("https://") || href.startsWith("http://")) {
      runAddress(href, null).catch(() => undefined)
    }
  }

  const links = (node: HTMLElement) => {
    node.addEventListener("click", follow)

    return () => node.removeEventListener("click", follow)
  }
</script>

{#if text === null}
  <div class="flex grow items-center justify-center">
    <span class="loading loading-spinner loading-sm text-base-content/40"></span>
  </div>
{:else if raw || !markdown}
  <pre class="min-h-0 grow overflow-auto p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">{text}</pre>
{:else}
  <div class="markdown min-h-0 grow overflow-auto p-3 text-sm select-text" {@attach links}>
    {@html renderMarkdown(withoutFrontmatter(text))}
  </div>
{/if}
