<script lang="ts">
  import { openExternal } from "$lib/platform/links"
  import Icon from "@iconify/svelte"
  import {
    Handle,
    NodeResizer,
    type NodeProps,
    Position,
    useSvelteFlow,
  } from "@xyflow/svelte"
  import { getContext } from "svelte"
  import { renderMarkdown } from "$lib/markdown/render"
  import { resolveLink } from "$lib/vault/links"
  import { basename, isCanvas, isNote, stem } from "$lib/vault/paths"
  import { texts, vault } from "$lib/vault/vault.svelte"
  import { openView } from "$lib/workspace/workspace.svelte"
  import type { CardFlowNode } from "./flow"
  import { type CanvasNode, colorOf, SIDES } from "./jsoncanvas"

  const { id, data, selected }: NodeProps<CardFlowNode> = $props()

  const { updateNodeData } = useSvelteFlow()

  const canvasPath = getContext<() => string>("canvas-path")

  const POSITIONS = {
    top: Position.Top,
    right: Position.Right,
    bottom: Position.Bottom,
    left: Position.Left,
  }

  let editing = $state(false)
  let draft = $state("")

  const node = $derived(data.node)

  const color = $derived(colorOf(node.color))

  const files = $derived(
    vault.entries.filter(e => !e.folder).map(e => e.path),
  )

  const tint = $derived(
    color
      ? `color-mix(in oklch, ${color} 12%, var(--color-base-100))`
      : undefined,
  )

  const editable = (value: CanvasNode) =>
    value.type === "text" || value.type === "group"

  const begin = () => {
    if (!editable(node)) {
      return
    }

    draft = node.type === "text" ? node.text : (node.type === "group" ? (node.label ?? "") : "")
    editing = true
  }

  const commit = () => {
    if (!editing) {
      return
    }

    editing = false

    const next =
      node.type === "text"
        ? { ...node, text: draft }
        : node.type === "group"
          ? { ...node, label: draft }
          : node

    if (next !== node) {
      updateNodeData(id, { node: next })
    }
  }

  const openFile = (file: string) => {
    if (isNote(file)) {
      openView("note", file)
    } else if (isCanvas(file)) {
      openView("canvas", file)
    }
  }

  const follow = (e: MouseEvent) => {
    const anchor = (e.target as Element | null)?.closest("a")

    if (!anchor) {
      return
    }

    e.preventDefault()

    const target = anchor.dataset.target

    if (!target) {
      openExternal(anchor.getAttribute("href") ?? "")

      return
    }

    const path = resolveLink(target, canvasPath(), files)

    if (path) {
      openFile(path)
    }
  }

  const focus = (element: HTMLElement) => {
    element.focus()
  }
</script>

<NodeResizer
  isVisible={selected}
  minWidth={120}
  minHeight={60}
  lineClass="canvas-resize-line"
  handleClass="canvas-resize-handle"
/>

{#each SIDES as side (side)}
  <Handle
    type="source"
    id={side}
    position={POSITIONS[side]}
    class="canvas-handle"
  />
{/each}

{#if node.type === "group"}
  <div
    class={[
      "relative size-full border border-dashed",
      selected ? "border-primary" : "border-base-content/25",
    ]}
    style:border-color={selected ? undefined : color}
    style:background-color={color
      ? `color-mix(in oklch, ${color} 6%, transparent)`
      : undefined}
  >
    <div class="absolute bottom-full left-0 pb-1">
      {#if editing}
        <input
          class="input input-xs nodrag"
          bind:value={draft}
          onblur={commit}
          onkeydown={e => e.key === "Enter" && commit()}
          use:focus
        />
      {:else}
        <button
          class={[
            "cursor-pointer text-sm font-medium text-base-content/70",
            "transition-colors duration-140 hover:text-base-content",
          ]}
          ondblclick={begin}
        >
          {node.label || "그룹"}
        </button>
      {/if}
    </div>
  </div>
{:else}
  <div
    class={[
      "flex size-full flex-col overflow-hidden border bg-base-100",
      "transition-colors duration-140",
      selected ? "border-primary" : "border-base-content/10",
    ]}
    style:border-color={selected ? undefined : color}
    style:background-color={tint}
    role="presentation"
    ondblclick={begin}
  >
    {#if node.type === "text"}
      {#if editing}
        <textarea
          class={[
            "nodrag nowheel size-full resize-none bg-transparent p-3",
            "text-sm leading-relaxed outline-none",
          ]}
          bind:value={draft}
          onblur={commit}
          onkeydown={e => e.key === "Escape" && commit()}
          use:focus
        ></textarea>
      {:else}
        <div
          class="canvas-md nowheel min-h-0 flex-1 overflow-auto p-3 text-sm"
          role="presentation"
          onclick={follow}
        >
          {#if node.text.trim()}
            {@html renderMarkdown(node.text)}
          {:else}
            <p class="text-base-content/40">내용 없음</p>
          {/if}
        </div>
      {/if}
    {:else if node.type === "file"}
      {@const exists = files.includes(node.file)}
      <div
        class={[
          "flex shrink-0 items-center gap-2 border-b border-base-content/10",
          "px-3 py-2",
        ]}
      >
        <Icon
          icon={isCanvas(node.file)
            ? "lucide:layout-dashboard"
            : "lucide:file-text"}
          class="size-4 shrink-0 text-base-content/50"
        />
        <span class="min-w-0 flex-1 truncate text-sm font-medium">
          {isNote(node.file) || isCanvas(node.file)
            ? stem(node.file)
            : basename(node.file)}
        </span>
        {#if exists}
          <button
            class="btn btn-ghost btn-square btn-xs nodrag"
            aria-label="열기"
            onclick={() => openFile(node.file)}
          >
            <Icon icon="lucide:arrow-up-right" class="size-3.5" />
          </button>
        {/if}
      </div>

      <div
        class="canvas-md nowheel min-h-0 flex-1 overflow-auto p-3 text-sm"
        role="presentation"
        onclick={follow}
      >
        {#if !exists}
          <p class="text-base-content/40">파일 없음</p>
        {:else if isNote(node.file)}
          {@html renderMarkdown(texts.get(node.file) ?? "")}
        {/if}
      </div>
    {:else if node.type === "link"}
      <div class="flex min-h-0 flex-1 flex-col justify-center gap-1 p-3">
        <div class="flex items-center gap-2 text-base-content/50">
          <Icon icon="lucide:link" class="size-4 shrink-0" />
          <span class="truncate text-xs">
            {URL.canParse(node.url) ? new URL(node.url).host : "링크"}
          </span>
        </div>
        <p class="select-text break-all text-sm">{node.url}</p>
      </div>
    {/if}
  </div>
{/if}
