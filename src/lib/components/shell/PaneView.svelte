<script lang="ts">
  import Icon from "@iconify/svelte"
  import { copyText } from "$lib/menu/clipboard"
  import { showMenu } from "$lib/menu/menu.svelte"
  import { newNote } from "$lib/workspace/commands"
  import {
    accept,
    drag,
    endDrag,
    payload,
    startDrag,
  } from "$lib/workspace/drag.svelte"
  import { layout } from "$lib/workspace/layout.svelte"
  import { openPath } from "$lib/workspace/navigate"
  import {
    activate,
    activeTab,
    closeOthers,
    closeTab,
    focusPane,
    moveTab,
    openView,
    type Pane,
    type Tab,
    splitPane,
    tabIcon,
    tabTitle,
    workspace,
  } from "$lib/workspace/workspace.svelte"
  import ViewHost from "./ViewHost.svelte"

  const { pane }: { pane: Pane } = $props()

  const current = $derived(activeTab(pane))

  const focused = $derived(workspace.focus === pane.id)

  let hover = $state<string | null>(null)

  const tabMenu = (event: MouseEvent, tab: Tab) =>
    showMenu(event, [
      { label: "닫기", icon: "lucide:x", keys: "Ctrl W", run: () => closeTab(pane, tab.id) },
      {
        label: "다른 탭 닫기",
        icon: "lucide:copy-x",
        disabled: pane.tabs.length < 2,
        run: () => closeOthers(pane, tab.id),
      },
      "separator",
      {
        label: "오른쪽으로 분할",
        icon: "lucide:columns-2",
        keys: "Ctrl \\",
        run: () => {
          activate(pane, tab.id)
          openView(tab.kind, tab.path, { split: true })
        },
      },
      ...(tab.path
        ? [
            "separator" as const,
            {
              label: "경로 복사",
              icon: "lucide:clipboard-copy",
              run: () => copyText(tab.path ?? ""),
            },
          ]
        : []),
    ])

  const drop = (event: DragEvent, before: string | null) => {
    event.stopPropagation()
    hover = null

    const tab = payload(event, "tab")
    const path = payload(event, "path")

    if (tab) {
      moveTab(tab, pane, before)
    } else if (path) {
      focusPane(pane.id)
      openPath(path, { newTab: true })
    }

    endDrag()
  }
</script>

<section
  class={[
    "flex min-w-0 flex-1 flex-col",
    !focused && "max-lg:hidden",
  ]}
  onfocusin={() => focusPane(pane.id)}
  onpointerdown={() => focusPane(pane.id)}
  aria-label="창"
>
  <div
    class={[
      "flex h-9 shrink-0 items-stretch border-b border-base-content/10",
      "bg-base-200",
    ]}
  >
    <div
      class={[
        "flex min-w-0 flex-1 overflow-x-auto",
        (drag.kind === "tab" || drag.kind === "path") && "bg-primary/5",
      ]}
      role="tablist"
      tabindex="-1"
      ondragover={e => accept(e, "tab", "path")}
      ondrop={e => drop(e, null)}
    >
      {#each pane.tabs as tab (tab.id)}
        {@const on = tab.id === pane.active}
        <div
          draggable="true"
          role="presentation"
          class={[
            "group relative flex max-w-52 shrink-0 items-center gap-1.5",
            "border-r border-base-content/10 pr-1 pl-3 text-sm",
            on
              ? "bg-base-100 text-base-content"
              : "text-base-content/55 hover:bg-base-content/5",
          ]}
          oncontextmenu={e => tabMenu(e, tab)}
          ondragstart={e => startDrag(e, "tab", tab.id)}
          ondragend={endDrag}
          ondragenter={() => (hover = tab.id)}
          ondragleave={() => (hover = null)}
          ondragover={e => accept(e, "tab", "path")}
          ondrop={e => drop(e, tab.id)}
        >
          {#if on && focused}
            <span class="absolute inset-x-0 top-0 h-0.5 bg-primary"></span>
          {/if}

          {#if hover === tab.id}
            <span class="absolute inset-y-0 left-0 w-0.5 bg-primary"></span>
          {/if}

          <button
            role="tab"
            aria-selected={on}
            class="flex min-w-0 cursor-pointer items-center gap-1.5 py-1"
            onclick={() => activate(pane, tab.id)}
            onauxclick={e => {
              if (e.button === 1) {
                closeTab(pane, tab.id)
              }
            }}
          >
            <Icon icon={tabIcon(tab)} class="size-3.5 shrink-0 opacity-60" />
            <span class="truncate">{tabTitle(tab)}</span>
          </button>

          <button
            class={[
              "btn btn-ghost btn-square btn-xs",
              !on && "lg:invisible lg:group-hover:visible",
            ]}
            aria-label="탭 닫기"
            onclick={() => closeTab(pane, tab.id)}
          >
            <Icon icon="lucide:x" class="size-3.5" />
          </button>
        </div>
      {/each}
    </div>

    <div class="flex shrink-0 items-center gap-0.5 px-1">
      <button
        class="btn btn-ghost btn-square btn-xs"
        aria-label="새 노트"
        title="새 노트"
        onclick={() => newNote()}
      >
        <Icon icon="lucide:plus" class="size-4" />
      </button>
      <button
        class="btn btn-ghost btn-square btn-xs max-lg:hidden"
        aria-label="오른쪽으로 분할"
        title="오른쪽으로 분할"
        onclick={() => splitPane(pane)}
      >
        <Icon icon="lucide:columns-2" class="size-4" />
      </button>
    </div>
  </div>

  <div class="flex min-h-0 flex-1 flex-col bg-base-100">
    {#if current}
      <ViewHost tab={current} />
    {:else}
      <div class="relative flex flex-1 items-center justify-center p-6">
        <div
          class={[
            "relative flex w-full max-w-sm flex-col items-center gap-3 border",
            "border-dashed border-base-content/15 bg-base-100/80 px-6 py-10",
            "text-center backdrop-blur-sm",
          ]}
        >
          <p class="font-medium">열린 파일 없음</p>
          <p class="text-sm text-base-content/50">
            새 노트를 만들거나 파일을 여세요.
          </p>
          <div class="flex gap-2">
            <button class="btn btn-primary btn-sm" onclick={() => newNote()}>
              새 노트
            </button>
            <button
              class="btn btn-sm"
              onclick={() => (layout.palette = "files")}
            >
              파일 열기
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</section>
