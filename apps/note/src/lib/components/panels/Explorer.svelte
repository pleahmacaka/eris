<script lang="ts">
  import Icon from "@iconify/svelte"
  import { SvelteSet } from "svelte/reactivity"
  import ConfirmDialog from "$lib/components/ui/ConfirmDialog.svelte"
  import { newCanvas, newFolder, newNote } from "$lib/workspace/commands"
  import { citeUrl } from "$lib/markdown/cite"
  import { copyText } from "$lib/menu/clipboard"
  import { type MenuItem, showMenu } from "$lib/menu/menu.svelte"
  import { accept, endDrag, payload } from "$lib/workspace/drag.svelte"
  import { closePanelsOnNarrow } from "$lib/workspace/layout.svelte"
  import { openPath } from "$lib/workspace/navigate"
  import { forget, focusedTab, retarget } from "$lib/workspace/workspace.svelte"
  import { basename, isNote } from "$lib/vault/paths"
  import { buildTree, type TreeNode } from "$lib/vault/tree"
  import {
    movePath,
    removePath,
    renamePath,
    vault,
  } from "$lib/vault/vault.svelte"
  import TreeItem from "./TreeItem.svelte"

  const open = new SvelteSet<string>()

  let renaming = $state<string | null>(null)
  let doomed = $state<TreeNode | null>(null)
  let confirming = $state(false)
  let failure = $state("")

  const tree = $derived(buildTree(vault.entries))

  const active = $derived(focusedTab()?.path ?? null)

  const toggle = (path: string) => {
    if (open.has(path)) {
      open.delete(path)
    } else {
      open.add(path)
    }
  }

  const select = (node: TreeNode, event: MouseEvent) => {
    openPath(node.path, { newTab: event.ctrlKey || event.metaKey })
    closePanelsOnNarrow()
  }

  const attempt = async (task: () => Promise<unknown>) => {
    failure = ""

    try {
      await task()
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    }
  }

  const rename = (node: TreeNode, name: string | null) => {
    if (renaming !== node.path) {
      return
    }

    renaming = null

    if (name === null || name.trim() === "") {
      return
    }

    attempt(async () => {
      const next = await renamePath(node.path, name)

      retarget(node.path, next)
    })
  }

  const act = (node: TreeNode, action: "rename" | "delete" | "note") => {
    if (action === "rename") {
      renaming = node.path
    } else if (action === "delete") {
      doomed = node
      confirming = true
    } else {
      open.add(node.path)
      attempt(() => newNote(node.path))
    }
  }

  const moveInto = (event: DragEvent, folder: string) => {
    const path = payload(event, "path")

    endDrag()

    if (!path) {
      return
    }

    attempt(async () => {
      const next = await movePath(path, folder)

      if (next !== path) {
        open.add(folder)
        retarget(path, next)
      }
    })
  }

  const creators = (folder: string): MenuItem[] => [
    {
      label: "새 노트",
      icon: "lucide:file-plus",
      run: () => {
        open.add(folder)
        attempt(() => newNote(folder))
      },
    },
    {
      label: "새 캔버스",
      icon: "lucide:layout-dashboard",
      run: () => {
        open.add(folder)
        attempt(() => newCanvas(folder))
      },
    },
    {
      label: "새 폴더",
      icon: "lucide:folder-plus",
      run: () => {
        open.add(folder)
        attempt(() => newFolder(folder))
      },
    },
  ]

  const menu = (event: MouseEvent, node: TreeNode) => {
    const common: MenuItem[] = [
      { label: "이름 변경", icon: "lucide:pencil", keys: "F2", run: () => (renaming = node.path) },
      { label: "경로 복사", icon: "lucide:clipboard-copy", run: () => copyText(node.path) },
    ]
    const cite: MenuItem[] = isNote(node.path)
      ? [{ label: "인용 링크 복사", icon: "lucide:quote", run: () => copyText(citeUrl(node.path)) }]
      : []
    const danger: MenuItem = {
      label: "삭제",
      icon: "lucide:trash-2",
      danger: true,
      run: () => act(node, "delete"),
    }

    showMenu(
      event,
      node.folder
        ? [...creators(node.path), "separator", ...common, "separator", danger]
        : [
            { label: "열기", icon: "lucide:file-text", run: () => openPath(node.path) },
            {
              label: "새 탭에서 열기",
              icon: "lucide:panel-top-open",
              run: () => openPath(node.path, { newTab: true }),
            },
            {
              label: "오른쪽에 분할해서 열기",
              icon: "lucide:columns-2",
              run: () => openPath(node.path, { split: true }),
            },
            "separator",
            ...common,
            ...cite,
            "separator",
            danger,
          ],
    )
  }

  const erase = () => {
    const node = doomed

    if (!node) {
      return
    }

    attempt(async () => {
      forget(node.path)
      await removePath(node.path)
    })
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div
    class="flex items-center gap-1 border-b border-base-content/10 px-2 py-1.5"
  >
    <span class="flex-1 px-1 text-xs font-medium text-base-content/60">
      파일
    </span>
    <button
      class="btn btn-ghost btn-square btn-xs"
      aria-label="새 노트"
      title="새 노트"
      onclick={() => attempt(() => newNote(""))}
    >
      <Icon icon="lucide:file-plus" class="size-4" />
    </button>
    <button
      class="btn btn-ghost btn-square btn-xs"
      aria-label="새 캔버스"
      title="새 캔버스"
      onclick={() => attempt(() => newCanvas(""))}
    >
      <Icon icon="lucide:layout-dashboard" class="size-4" />
    </button>
    <button
      class="btn btn-ghost btn-square btn-xs"
      aria-label="새 폴더"
      title="새 폴더"
      onclick={() => attempt(() => newFolder(""))}
    >
      <Icon icon="lucide:folder-plus" class="size-4" />
    </button>
    <button
      class="btn btn-ghost btn-square btn-xs"
      aria-label="모두 접기"
      title="모두 접기"
      onclick={() => open.clear()}
    >
      <Icon icon="lucide:chevrons-down-up" class="size-4" />
    </button>
  </div>

  {#if failure}
    <p class="px-3 py-2 text-xs text-error">{failure}</p>
  {/if}

  <div
    class="min-h-0 flex-1 overflow-y-auto py-1"
    role="tree"
    tabindex="-1"
    oncontextmenu={e => showMenu(e, creators(""))}
    ondragover={e => accept(e, "path")}
    ondrop={e => moveInto(e, "")}
  >
    {#if vault.error}
      <p class="px-3 py-2 text-xs text-error">{vault.error}</p>
    {:else if vault.ready && tree.length === 0}
      <div
        class={[
          "m-3 border border-dashed border-base-content/15 px-4 py-8",
          "text-center text-sm text-base-content/50",
        ]}
      >
        파일 없음
      </div>
    {:else}
      <ul>
        {#each tree as node (node.path)}
          <TreeItem
            {node}
            depth={0}
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
  </div>
</div>

<ConfirmDialog
  bind:open={confirming}
  title={`${doomed ? basename(doomed.path) : ""} 삭제`}
  body={doomed?.folder ? "폴더 안의 모든 파일이 함께 삭제됩니다." : ""}
  action="삭제"
  onconfirm={erase}
/>
