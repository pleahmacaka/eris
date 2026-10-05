<script lang="ts">
  import Icon from "@iconify/svelte"
  import {
    Background,
    BackgroundVariant,
    type Connection,
    ConnectionMode,
    Panel,
    SvelteFlow,
    useSvelteFlow,
    type XYPosition,
  } from "@xyflow/svelte"
  import { onDestroy, setContext, untrack } from "svelte"
  import { isNote, stem } from "$lib/vault/paths"
  import {
    onVaultChange,
    readFile,
    saveFile,
    vault,
  } from "$lib/vault/vault.svelte"
  import CardNode from "./CardNode.svelte"
  import {
    type CanvasFlowEdge,
    type CardFlowNode,
    connectEdge,
    fromFlow,
    toFlowEdge,
    toFlowNode,
  } from "./flow"
  import {
    type CanvasDoc,
    type CanvasNode,
    newCanvasId,
    parseCanvas,
    serializeCanvas,
  } from "./jsoncanvas"

  const { path }: { path: string } = $props()

  setContext("canvas-path", () => path)

  const { fitView, screenToFlowPosition, deleteElements } = useSvelteFlow()

  const nodeTypes = { card: CardNode }

  const SAVE_DELAY = 500

  let doc = $state.raw<CanvasDoc | null>(null)
  let nodes = $state.raw<CardFlowNode[]>([])
  let edges = $state.raw<CanvasFlowEdge[]>([])
  let status = $state<"loading" | "ready" | "invalid" | "missing">("loading")
  let picking = $state(false)
  let query = $state("")
  let container = $state<HTMLDivElement>()
  let saved = ""
  let timer: ReturnType<typeof setTimeout> | undefined

  const current = () =>
    doc ? serializeCanvas(fromFlow(doc, nodes, edges)) : null

  const notes = $derived(
    vault.entries
      .filter(e => !e.folder && isNote(e.path))
      .map(e => e.path)
      .filter(p => p.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
      .slice(0, 50),
  )

  const selection = $derived(
    nodes.some(n => n.selected) || edges.some(e => e.selected),
  )

  const flush = async () => {
    clearTimeout(timer)
    timer = undefined

    const text = current()

    if (text === null || text === saved) {
      return
    }

    saved = text
    await saveFile(path, text)
  }

  const load = async () => {
    let text: string

    try {
      text = await readFile(path)
    } catch {
      status = "missing"
      doc = null

      return
    }

    const parsed = parseCanvas(text)

    if (!parsed) {
      status = "invalid"
      doc = null

      return
    }

    doc = parsed
    nodes = parsed.nodes.map(toFlowNode)
    edges = parsed.edges.map(toFlowEdge)
    saved = current() ?? ""
    status = "ready"
  }

  $effect(() => {
    path

    untrack(() => {
      status = "loading"
      load()
    })
  })

  $effect(() => {
    if (status !== "ready") {
      return
    }

    if (current() !== saved) {
      clearTimeout(timer)
      timer = setTimeout(flush, SAVE_DELAY)
    }
  })

  const stop = onVaultChange(change => {
    if (!change.paths.includes(path) || status === "loading") {
      return
    }

    if (status === "ready" && current() !== saved) {
      return
    }

    readFile(path)
      .then(text => {
        if (text !== saved) {
          load()
        }
      })
      .catch(() => {
        status = "missing"
      })
  })

  onDestroy(() => {
    stop()
    flush()
  })

  const center = (): XYPosition => {
    const rect = container?.getBoundingClientRect()

    return screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
    })
  }

  const add = (node: CanvasNode) => {
    nodes = [
      ...nodes.map(n => (n.selected ? { ...n, selected: false } : n)),
      { ...toFlowNode(node), selected: true },
    ]
  }

  const addText = (at = center()) =>
    add({
      id: newCanvasId(),
      type: "text",
      text: "",
      x: Math.round(at.x - 130),
      y: Math.round(at.y - 60),
      width: 260,
      height: 120,
    })

  const addNote = (file: string) => {
    const at = center()

    add({
      id: newCanvasId(),
      type: "file",
      file,
      x: Math.round(at.x - 200),
      y: Math.round(at.y - 200),
      width: 400,
      height: 400,
    })

    picking = false
    query = ""
  }

  const removeSelection = () =>
    deleteElements({
      nodes: nodes.filter(n => n.selected),
      edges: edges.filter(e => e.selected),
    })

  const onPaneDoubleClick = (e: MouseEvent) => {
    if ((e.target as Element).classList.contains("svelte-flow__pane")) {
      addText(screenToFlowPosition({ x: e.clientX, y: e.clientY }))
    }
  }

  const beforeConnect = (connection: Connection) => connectEdge(connection)
</script>

<div
  class="canvas-board relative size-full min-h-0"
  bind:this={container}
  role="presentation"
  ondblclick={onPaneDoubleClick}
>
  {#if status === "ready"}
    <SvelteFlow
      bind:nodes
      bind:edges
      {nodeTypes}
      fitView
      minZoom={0.1}
      maxZoom={4}
      zoomOnDoubleClick={false}
      connectionMode={ConnectionMode.Loose}
      deleteKey={["Backspace", "Delete"]}
      defaultMarkerColor="var(--xy-edge-stroke)"
      onbeforeconnect={beforeConnect}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1.5}
        bgColor="var(--color-base-200)"
        patternColor="color-mix(in oklch, var(--color-base-content) 18%, transparent)"
      />

      <Panel position="top-left">
        <div class="join border border-base-content/10 bg-base-100">
          <button
            class="btn btn-ghost btn-sm join-item"
            onclick={() => addText()}
          >
            <Icon icon="lucide:type" class="size-4" />
            텍스트 카드
          </button>
          <button
            class={["btn btn-ghost btn-sm join-item", picking && "btn-active"]}
            onclick={() => (picking = !picking)}
          >
            <Icon icon="lucide:file-plus" class="size-4" />
            노트 카드
          </button>
          <button
            class="btn btn-ghost btn-square btn-sm join-item"
            aria-label="선택 삭제"
            disabled={!selection}
            onclick={removeSelection}
          >
            <Icon icon="lucide:trash-2" class="size-4" />
          </button>
          <button
            class="btn btn-ghost btn-square btn-sm join-item"
            aria-label="화면 맞춤"
            onclick={() => fitView({ duration: 140 })}
          >
            <Icon icon="lucide:scan" class="size-4" />
          </button>
        </div>

        {#if picking}
          <div
            class={[
              "mt-2 flex w-72 flex-col border border-base-content/10",
              "bg-base-100",
            ]}
          >
            <input
              class="input input-sm w-full border-0 border-b border-base-content/10"
              placeholder="노트 검색"
              aria-label="노트 검색"
              bind:value={query}
              onkeydown={e => e.key === "Escape" && (picking = false)}
            />

            <ul class="nowheel max-h-72 overflow-y-auto py-1">
              {#each notes as note (note)}
                <li>
                  <button
                    class={[
                      "flex w-full cursor-pointer flex-col px-3 py-1.5",
                      "text-left transition-colors duration-140",
                      "hover:bg-base-content/5",
                    ]}
                    onclick={() => addNote(note)}
                  >
                    <span class="truncate text-sm">{stem(note)}</span>
                    <span class="truncate text-xs text-base-content/40">
                      {note}
                    </span>
                  </button>
                </li>
              {:else}
                <li class="px-3 py-2 text-sm text-base-content/50">
                  노트 없음
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </Panel>
    </SvelteFlow>
  {:else if status === "loading"}
    <div class="flex size-full items-center justify-center">
      <span class="loading loading-spinner loading-sm text-base-content/40"></span>
    </div>
  {:else}
    <div class="flex size-full items-center justify-center p-6">
      <div
        class={[
          "flex max-w-sm flex-col items-center gap-2 border border-dashed",
          "border-base-content/15 px-6 py-10 text-center",
        ]}
      >
        <Icon icon="lucide:triangle-alert" class="size-6 text-warning" />
        <p class="font-medium">
          {status === "invalid"
            ? "캔버스를 읽을 수 없습니다."
            : "캔버스를 열 수 없습니다."}
        </p>
        <p class="text-sm text-base-content/50">
          {status === "invalid"
            ? "파일 형식을 확인하세요."
            : "파일이 이동되었거나 삭제되었는지 확인하세요."}
        </p>
      </div>
    </div>
  {/if}
</div>
