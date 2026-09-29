<script lang="ts">
  import Icon from "@iconify/svelte"
  import { newCanvas, newNote } from "$lib/workspace/commands"
  import {
    accept,
    drag,
    endDrag,
    payload,
    startDrag,
  } from "$lib/workspace/drag.svelte"
  import {
    type ActionId,
    layout,
    moveAction,
    movePanel,
    PANELS,
    type PanelId,
    showPanel,
  } from "$lib/workspace/layout.svelte"
  import { openView } from "$lib/workspace/workspace.svelte"

  const { horizontal = false }: { horizontal?: boolean } = $props()

  const ACTIONS: Record<ActionId, { label: string; icon: string; run: () => unknown }> = {
    "new-note": { label: "새 노트", icon: "lucide:file-plus", run: () => newNote() },
    "new-canvas": {
      label: "새 캔버스",
      icon: "lucide:layout-dashboard",
      run: () => newCanvas(),
    },
    graph: { label: "그래프", icon: "lucide:waypoints", run: () => openView("graph") },
    calendar: {
      label: "캘린더",
      icon: "lucide:calendar-days",
      run: () => openView("calendar"),
    },
    todos: { label: "할 일", icon: "lucide:list-checks", run: () => openView("todos") },
    palette: {
      label: "명령 팔레트",
      icon: "lucide:command",
      run: () => (layout.palette = "commands"),
    },
  }

  let hover = $state<string | null>(null)

  const dropPanel = (event: DragEvent, before?: PanelId) => {
    const panel = payload(event, "panel") as PanelId

    if (panel in PANELS) {
      movePanel(panel, "left", before)
    }

    hover = null
    endDrag()
  }

  const dropAction = (event: DragEvent, before: ActionId | null) => {
    const action = payload(event, "action") as ActionId

    if (action in ACTIONS) {
      moveAction(action, before)
    }

    hover = null
    endDrag()
  }
</script>

<nav
  class={[
    "flex shrink-0 gap-1 bg-base-100",
    horizontal
      ? "flex-wrap border-b border-base-content/10 p-2"
      : "w-12 flex-col items-center border-r border-base-content/10 py-2",
    drag.kind === "panel" && "bg-primary/5",
  ]}
  aria-label="활동 표시줄"
  ondragover={e => accept(e, "panel")}
  ondrop={e => dropPanel(e)}
>
  {#each layout.docks.left as panel (panel)}
    {@const on = layout.open.left && layout.active.left === panel}
    <button
      draggable="true"
      class={[
        "btn btn-ghost btn-square btn-sm relative",
        on ? "text-base-content" : "text-base-content/50",
        hover === panel && "outline outline-primary",
      ]}
      aria-label={PANELS[panel].label}
      title={PANELS[panel].label}
      onclick={() => showPanel(panel)}
      ondragstart={e => startDrag(e, "panel", panel)}
      ondragend={endDrag}
      ondragenter={() => (hover = panel)}
      ondragleave={() => (hover = null)}
      ondragover={e => accept(e, "panel")}
      ondrop={e => {
        e.stopPropagation()
        dropPanel(e, panel)
      }}
    >
      {#if on && !horizontal}
        <span class="absolute inset-y-1 -left-2 w-0.5 bg-primary"></span>
      {/if}
      <Icon icon={PANELS[panel].icon} class="size-4.5" />
    </button>
  {/each}

  <span
    class={[
      "bg-base-content/10",
      horizontal ? "mx-1 w-px self-stretch" : "my-1 h-px w-6",
    ]}
  ></span>

  {#each layout.actions as action (action)}
    <button
      draggable="true"
      class={[
        "btn btn-ghost btn-square btn-sm text-base-content/60",
        hover === action && "outline outline-primary",
      ]}
      aria-label={ACTIONS[action].label}
      title={ACTIONS[action].label}
      onclick={ACTIONS[action].run}
      ondragstart={e => startDrag(e, "action", action)}
      ondragend={endDrag}
      ondragenter={() => (hover = action)}
      ondragleave={() => (hover = null)}
      ondragover={e => accept(e, "action")}
      ondrop={e => {
        e.stopPropagation()
        dropAction(e, action)
      }}
    >
      <Icon icon={ACTIONS[action].icon} class="size-4.5" />
    </button>
  {/each}

  <button
    class={[
      "btn btn-ghost btn-square btn-sm text-base-content/60",
      !horizontal && "mt-auto",
    ]}
    aria-label="설정"
    title="설정"
    ondragover={e => accept(e, "action")}
    ondrop={e => {
      e.stopPropagation()
      dropAction(e, null)
    }}
    onclick={() => openView("settings")}
  >
    <Icon icon="lucide:settings" class="size-4.5" />
  </button>
</nav>
