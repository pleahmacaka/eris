<script lang="ts">
import { logoPainter } from "#lib/brand/ascii/sources.js"
import AsciiArt from "#lib/components/brand/AsciiArt.svelte"
import Backdrop from "#lib/components/chat/Backdrop.svelte"

type Props = { title: string; body: string }

let { title, body }: Props = $props()
</script>

<div
  class={[
    "relative isolate flex min-h-0 flex-1 flex-col items-center justify-center",
    "gap-5 overflow-hidden p-8 text-center",
  ]}
>
  <Backdrop />
  <AsciiArt paint={logoPainter} cols={48} rows={26} interactive class="w-40 cursor-crosshair" />
  <h2 class="font-black text-3xl tracking-tighter">{title}</h2>
  <p class="max-w-sm text-muted">{body}</p>
</div>
