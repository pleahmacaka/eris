<script lang="ts">
  import Icon from "@iconify/svelte"
  import { isCanvas, stem } from "$lib/vault/paths"
  import type { TreeNode } from "$lib/vault/tree"
  import { accept, endDrag, startDrag } from "$lib/workspace/drag.svelte"
  import Self from "./TreeItem.svelte"

  const {
    node,
    depth,
    open,
    active,
    renaming,
    toggle,
    select,
    rename,
    act,
    moveInto,
    menu,
  }: {
    node: TreeNode
    depth: number
    open: Set<string>
    active: string | null
    renaming: string | null
    toggle: (path: string) => void
    select: (node: TreeNode, event: MouseEvent) => void
    rename: (node: TreeNode, name: string | null) => void
    act: (node: TreeNode, action: "rename" | "delete" | "note") => void
    moveInto: (event: DragEvent, folder: string) => void
    menu: (event: MouseEvent, node: TreeNode) => void
  } = $props()

  let target = $state(false)

  const expanded = $derived(node.folder && open.has(node.path))

  const label = $derived(node.folder ? node.name : stem(node.path))

  const icon = $derived(
    node.folder
      ? expanded
        ? "lucide:folder-open"
        : "lucide:folder"
      : isCanvas(node.path)
        ? "lucide:layout-dashboard"
        : "lucide:file-text",
  )

  const focusInput = (input: HTMLInputElement) => {
    input.focus()
    input.select()
  }
</script>

<li>
  <div
    draggable={renaming !== node.path}
    role="treeitem"
    aria-selected={active === node.path}
    aria-expanded={node.folder ? expanded : undefined}
    tabindex="-1"
    class={[
      "group relative flex items-center gap-1.5 pr-1 text-sm transition",
      active === node.path
        ? "bg-base-content/8 text-base-content"
        : "text-base-content/70 hover:bg-base-content/5",
      target && "bg-primary/15 outline outline-primary/50",
    ]}
    style:padding-left="{0.5 + depth * 0.875}rem"
    oncontextmenu={e => menu(e, node)}
    ondragstart={e => startDrag(e, "path", node.path)}
    ondragend={endDrag}
    ondragenter={() => (target = node.folder)}
    ondragleave={() => (target = false)}
    ondragover={e => {
      if (node.folder) {
        accept(e, "path")
      }
    }}
    ondrop={e => {
      target = false

      if (node.folder) {
        e.stopPropagation()
        moveInto(e, node.path)
      }
    }}
  >
    {#if active === node.path}
      <span class="absolute inset-y-0.5 left-0 w-0.5 bg-primary"></span>
    {/if}

    {#if renaming === node.path}
      <Icon {icon} class="size-4 shrink-0 opacity-60" />
      <input
        class="input input-xs min-w-0 flex-1"
        value={label}
        use:focusInput
        onkeydown={e => {
          if (e.key === "Enter") {
            rename(node, e.currentTarget.value)
          } else if (e.key === "Escape") {
            rename(node, null)
          }
        }}
        onblur={e => rename(node, e.currentTarget.value)}
      />
    {:else}
      <button
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 py-1 text-left"
        onclick={e => (node.folder ? toggle(node.path) : select(node, e))}
      >
        <Icon {icon} class="size-4 shrink-0 opacity-60" />
        <span class="truncate">{label}</span>
      </button>

      <div class="flex shrink-0 lg:hidden lg:group-hover:flex lg:group-focus-within:flex">
        {#if node.folder}
          <button
            class="btn btn-ghost btn-square btn-xs"
            aria-label="이 폴더에 새 노트"
            onclick={() => act(node, "note")}
          >
            <Icon icon="lucide:file-plus" class="size-3.5" />
          </button>
        {/if}
        <button
          class="btn btn-ghost btn-square btn-xs"
          aria-label="이름 변경"
          onclick={() => act(node, "rename")}
        >
          <Icon icon="lucide:pencil" class="size-3.5" />
        </button>
        <button
          class="btn btn-ghost btn-square btn-xs"
          aria-label="삭제"
          onclick={() => act(node, "delete")}
        >
          <Icon icon="lucide:trash-2" class="size-3.5" />
        </button>
      </div>
    {/if}
  </div>

  {#if expanded && node.children.length > 0}
    <ul>
      {#each node.children as child (child.path)}
        <Self
          node={child}
          depth={depth + 1}
          {open}
          {active}
          {renaming}
          {toggle}
          {select}
          {rename}
          {act}
          {moveInto}
          {menu}
        />
      {/each}
    </ul>
  {/if}
</li>
