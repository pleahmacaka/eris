<script lang="ts">
  import "@xyflow/svelte/dist/base.css"
  import "./canvas.css"
  import { SvelteFlowProvider } from "@xyflow/svelte"
  import CanvasBoard from "./CanvasBoard.svelte"

  const { path }: { path: string } = $props()
</script>

<SvelteFlowProvider>
  <CanvasBoard {path} />
</SvelteFlowProvider>
