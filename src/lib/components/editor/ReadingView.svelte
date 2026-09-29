<script lang="ts">
  import { citedPath } from "$lib/markdown/cite"
  import { renderMarkdown } from "$lib/markdown/render"
  import { openExternal } from "$lib/platform/links"
  import { openLink, openPath } from "$lib/workspace/navigate"

  const { text, path }: { text: string; path: string } = $props()

  const html = $derived(renderMarkdown(text))

  const follow = (event: MouseEvent) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a")

    if (!link) {
      return
    }

    event.preventDefault()
    go({
      target: link.dataset.target ?? null,
      href: link.getAttribute("href"),
      newTab: event.ctrlKey || event.metaKey,
    })
  }

  const go = (link: {
    target: string | null
    href: string | null
    newTab: boolean
  }) => {
    const cited = citedPath(link.href ?? "")

    if (link.target) {
      openLink(link.target, path, link.newTab)
    } else if (cited) {
      openPath(cited, { newTab: link.newTab })
    } else if (link.href) {
      openExternal(link.href)
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
