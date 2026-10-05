<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core"
  import { rem } from "$lib/ascii/motion"

  const {
    html,
    onlink,
  }: {
    html: string
    onlink: (link: { target: string | null; href: string | null; newTab: boolean }) => void
  } = $props()

  const src = convertFileSrc("frame.html", "sandbox")

  let frame = $state<HTMLIFrameElement>()
  let height = $state(20)

  const theme = () => {
    const style = getComputedStyle(document.documentElement)
    const color = (name: string) => style.getPropertyValue(name).trim()

    return `<style>
:root { color-scheme: ${style.colorScheme}; }
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  line-height: 1.75;
  color: ${color("--color-base-content")};
  background: transparent;
  overflow-wrap: anywhere;
}
a { color: ${color("--color-primary")}; }
img { max-width: 100%; }
</style>`
  }

  const send = () => {
    frame?.contentWindow?.postMessage(
      { type: "render", html: `${theme()}${html}` },
      "*",
    )
  }

  $effect(() => {
    const receive = (event: MessageEvent) => {
      if (!frame || event.source !== frame.contentWindow) {
        return
      }

      if (event.data?.type === "height") {
        height = Number(event.data.height) / rem(1) || height
      } else if (event.data?.type === "link") {
        onlink({
          target: typeof event.data.target === "string" ? event.data.target : null,
          href: typeof event.data.href === "string" ? event.data.href : null,
          newTab: event.data.newTab === true,
        })
      }
    }

    addEventListener("message", receive)

    return () => removeEventListener("message", receive)
  })
</script>

{#key html}
  <iframe
    bind:this={frame}
    title="노트 미리보기"
    {src}
    sandbox="allow-scripts"
    class="block w-full border-0"
    style:height="{height}rem"
    onload={send}
  ></iframe>
{/key}
