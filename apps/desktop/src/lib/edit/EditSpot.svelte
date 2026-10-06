<script lang="ts">
  import type { Snippet } from "svelte"
  import type { MenuBox } from "../dock/layout.svelte"
  import { clearReorder, editing, reorder } from "./edit.svelte"

  type Props = {
    id: string
    label: string
    children: Snippet
    options?: Snippet
    placement?: "up" | "down"
    align?: "start" | "center" | "end"
    class?: string
    onmenu?: (rect: MenuBox | null) => void
    dragKey?: string
    ondropped?: (from: string, to: string, after: boolean) => void
  }

  let {
    id,
    label,
    children,
    options,
    placement = "up",
    align = "center",
    class: klass = "",
    onmenu,
    dragKey,
    ondropped,
  }: Props = $props()

  const ALIGN = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }

  let card = $state<HTMLElement>()
  let root = $state<HTMLElement>()

  const open = $derived(editing.on && editing.open === id)

  const dropping = $derived(
    !!dragKey && reorder.over === dragKey && reorder.id !== dragKey,
  )

  const onDragStart = (e: DragEvent) => {
    if (!dragKey) {
      return
    }

    reorder.id = dragKey
    editing.open = null

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"
    }
  }

  const onDragOver = (e: DragEvent) => {
    if (!dragKey || !reorder.id || reorder.id === dragKey) {
      return
    }

    e.preventDefault()

    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()

    reorder.after = e.clientX > box.left + box.width / 2
    reorder.over = dragKey
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()

    const from = reorder.id
    const after = reorder.after

    clearReorder()

    if (dragKey && from && from !== dragKey) {
      ondropped?.(from, dragKey, after)
    }
  }

  const toggle = () => {
    editing.open = open ? null : id
  }

  $effect(() => {
    if (open && card) {
      onmenu?.(card.getBoundingClientRect())

      return () => onmenu?.(null)
    }
  })

  const onwindowdown = (e: MouseEvent) => {
    if (open && root && !root.contains(e.target as Node)) {
      editing.open = null
    }
  }

  $effect(() => {
    const clear = () => (editing.open = null)

    window.addEventListener("eris-close-menus", clear)

    return () => window.removeEventListener("eris-close-menus", clear)
  })
</script>

<svelte:window onmousedown={onwindowdown} />

<div
  bind:this={root}
  class={[
    "relative flex min-w-0 items-center",
    !!dragKey && reorder.id === dragKey && "opacity-50",
    klass,
  ]}
>
  {@render children()}

  {#if editing.on}
    <button
      type="button"
      class={[
        "absolute inset-0 z-40 rounded-field ring-2 ring-primary/70 transition-colors duration-100",
        open ? "bg-primary/25" : "bg-primary/10 hover:bg-primary/20",
      ]}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      draggable={!!dragKey}
      ondragstart={onDragStart}
      ondragover={onDragOver}
      ondrop={onDrop}
      ondragend={clearReorder}
      onclick={toggle}
    >
      {#if dropping}
        <span
          class={[
            "absolute -top-1 -bottom-1 w-1 rounded-full bg-primary shadow-md",
            reorder.after ? "-right-1.5" : "-left-1.5",
          ]}
        ></span>
      {/if}

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
