<script lang="ts">
import type { Snippet } from "svelte"
import { fly, scale } from "svelte/transition"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { duration, QUICK_MS, SHEET_MS } from "#lib/motion/durations.js"
import { layoutStore } from "#lib/store/layout.svelte.js"

type Props = {
  open: boolean
  title: string
  size?: "compact" | "medium" | "wide"
  align?: "start" | "center"
  onclose: () => void
  children: Snippet
  actions?: Snippet
}

let {
  open,
  title,
  size = "compact",
  align = "start",
  onclose,
  children,
  actions,
}: Props = $props()

let dialog = $state<HTMLDialogElement>()

$effect(() => {
  if (dialog && open && !dialog.open) {
    dialog.showModal()
  }
})

const enter = (node: HTMLElement) =>
  layoutStore.narrow
    ? fly(node, { y: 160, duration: duration(SHEET_MS) })
    : scale(node, { start: 0.96, duration: duration(QUICK_MS) })

const leave = (node: HTMLElement) =>
  layoutStore.narrow
    ? fly(node, { y: 160, duration: duration(QUICK_MS) })
    : scale(node, { start: 0.98, duration: duration(QUICK_MS) })
</script>

<dialog
  bind:this={dialog}
  class={["modal", layoutStore.narrow && "modal-bottom"]}
  {onclose}
  oncancel={event => {
    event.preventDefault()
    onclose()
  }}
>
  {#if open}
    <div
      class={[
        "modal-box rounded-box border border-base-content/10 bg-base-100",
        size === "medium" && "max-w-2xl",
        size === "wide" && "flex h-176 max-w-4xl flex-col",
      ]}
      in:enter
      out:leave
      onoutroend={() => dialog?.close()}
    >
      <h2
        class={[
          "font-black text-xl tracking-tighter",
          align === "center" && "text-center",
        ]}
      >
        {title}
      </h2>
      <div class={["mt-4 flex flex-col gap-3", size === "wide" && "min-h-0 flex-1"]}>
        {@render children()}
      </div>
      {#if actions}
        <div class="modal-action">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
  <button
    type="button"
    class="modal-backdrop cursor-pointer"
    aria-label={i18n.t("ui.close")}
    onclick={onclose}
  ></button>
</dialog>
