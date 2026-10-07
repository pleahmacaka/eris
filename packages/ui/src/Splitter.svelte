<script lang="ts">
  import { type Resize, resizeHandle } from "./pointer"

  let {
    resize,
    label,
    onreset,
  }: { resize: Resize; label?: string; onreset?: () => void } = $props()

  const vertical = $derived(resize.axis === "x")
</script>

<div
  role="separator"
  aria-orientation={vertical ? "vertical" : "horizontal"}
  aria-label={label}
  class={[
    "group relative z-10 flex shrink-0 items-center justify-center",
    vertical ? "-mx-1 w-2 cursor-col-resize" : "-my-1 h-2 cursor-row-resize",
  ]}
  onpointerdown={e => resizeHandle(resize)(e)}
  ondblclick={onreset}
>
  <div
    class={[
      "bg-base-content/10 transition-colors group-hover:bg-primary/50",
      vertical ? "h-full w-px group-hover:w-0.5" : "h-px w-full group-hover:h-0.5",
    ]}
  ></div>
</div>
