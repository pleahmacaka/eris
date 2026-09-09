<script lang="ts">
  import type { Snippet } from "svelte"
  import { editing } from "./edit.svelte"

  type Props = {
    id: string
    label: string
    children: Snippet
    options?: Snippet
    placement?: "up" | "down"
    align?: "start" | "center" | "end"
    onmenu?: (height: number) => void
  }

  let {
    id,
    label,
    children,
    options,
    placement = "up",
    align = "center",
    onmenu,
  }: Props = $props()

  const GAP = 16

  const ALIGN = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }

  let card = $state<HTMLElement>()
  let root = $state<HTMLElement>()

  const open = $derived(editing.on && editing.open === id)

  const toggle = () => {
    editing.open = open ? null : id
  }

  $effect(() => {
    if (open && card) {
      onmenu?.(card.offsetHeight + GAP)

      return () => onmenu?.(0)
    }
  })

  const onwindowdown = (e: MouseEvent) => {
    if (open && root && !root.contains(e.target as Node)) {
      editing.open = null
    }
  }
</script>

<svelte:window onmousedown={onwindowdown} />

<div bind:this={root} class="relative flex min-w-0 items-center">
  {@render children()}

  {#if editing.on}
    <button
      type="button"
      class={[
        "absolute inset-0 z-40 rounded-field ring-2 ring-primary/70 transition-colors duration-150",
        open ? "bg-primary/25" : "bg-primary/10 hover:bg-primary/20",
      ]}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onclick={toggle}
    >
      <span
        class={[
          "badge badge-primary badge-xs absolute left-1/2 -translate-x-1/2 whitespace-nowrap",
          placement === "up" ? "-top-2" : "-bottom-2",
        ]}
      >
        {label}
      </span>
    </button>

    {#if open && options}
      <div
        bind:this={card}
        class={[
          "absolute z-50 w-72 rounded-box border border-base-content/10 bg-base-100/95 p-3 shadow-xl backdrop-blur-xl",
          placement === "up" ? "bottom-full mb-3" : "top-full mt-3",
          ALIGN[align],
        ]}
        role="dialog"
        aria-label={label}
      >
        <div class="mb-2 text-xs font-semibold text-base-content/60">{label}</div>

        <div class="flex flex-col gap-1">
          {@render options()}
        </div>
      </div>
    {/if}
  {/if}
</div>
