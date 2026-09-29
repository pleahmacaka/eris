<script lang="ts">
  import { renderMarkdown } from "$lib/markdown/render"
  import { openLink } from "$lib/workspace/navigate"

  const { text, path }: { text: string; path: string } = $props()

  const html = $derived(renderMarkdown(text))

  const follow = (event: MouseEvent) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a")

    if (!link) {
      return
    }

    event.preventDefault()

    if (link.dataset.target) {
      openLink(link.dataset.target, path, event.ctrlKey || event.metaKey)
    }
  }

  const links = (node: HTMLElement) => {
    node.addEventListener("click", follow)

    return {
      destroy: () => node.removeEventListener("click", follow),
    }
  }
</script>

<article class="markdown mx-auto max-w-184 px-6 py-6 pb-40" use:links>
  {@html html}
</article>
