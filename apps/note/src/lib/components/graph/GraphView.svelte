<script lang="ts">
  import Icon from "@iconify/svelte"
  import {
    forceCollide,
    forceLink,
    forceManyBody,
    forceX,
    forceY,
    type Simulation,
  } from "d3-force"
  import { Chart, type ChartState, Svg } from "layerchart"
  import { ForceSimulation } from "layerchart/force"
  import { texts, vault } from "$lib/vault/vault.svelte"
  import { openView } from "$lib/workspace/workspace.svelte"
  import {
    buildGraph,
    type Graph,
    type GraphLink,
    type GraphNode,
    radius,
  } from "./graph"

  const CROWDED = 150
  const CLICK_DISTANCE = 4

  type Drag = {
    node: GraphNode
    simulation: Simulation<GraphNode, GraphLink>
    x: number
    y: number
    moved: boolean
  }

  let context = $state<ChartState>()
  let hovered = $state<string | null>(null)
  let drag: Drag | null = null
  let cached: Graph | null = null

  const graph = $derived.by(() => {
    const paths = vault.entries.filter(e => !e.folder).map(e => e.path)
    const next = buildGraph(texts, paths, cached?.nodes)

    if (cached?.key === next.key) {
      return cached
    }

    cached = next

    return next
  })

  const width = $derived(context?.width ?? 0)

  const height = $derived(context?.height ?? 0)

  const scale = $derived(context?.transform.scale ?? 1)

  const linkForce = $derived(
    forceLink<GraphNode, GraphLink>(graph.links)
      .id(d => d.id)
      .distance(50)
      .strength(0.4),
  )

  const forces = $derived({
    link: linkForce,
    charge: forceManyBody<GraphNode>().strength(-90).distanceMax(500),
    x: forceX<GraphNode>(width / 2).strength(0.05),
    y: forceY<GraphNode>(height / 2).strength(0.05),
    collide: forceCollide<GraphNode>(d => radius(d) + 3),
  })

  const near = (id: string) =>
    hovered !== null &&
    (id === hovered || (graph.neighbours.get(hovered)?.has(id) ?? false))

  const faded = (id: string) => hovered !== null && !near(id)

  const labelled = (id: string) =>
    near(id) || scale >= (graph.nodes.length > CROWDED ? 1.6 : 0.6)

  const endpoint = (end: GraphLink["source"]) =>
    typeof end === "object" ? end.id : String(end)

  const touches = (link: GraphLink) =>
    hovered !== null &&
    (endpoint(link.source) === hovered || endpoint(link.target) === hovered)

  const open = (node: GraphNode) => openView("note", node.id)

  const press = (
    e: PointerEvent & { currentTarget: SVGCircleElement },
    node: GraphNode,
    simulation: Simulation<GraphNode, GraphLink>,
  ) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag = { node, simulation, x: e.clientX, y: e.clientY, moved: false }
  }

  const move = (e: PointerEvent) => {
    if (!drag) {
      return
    }

    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y

    if (!drag.moved && Math.hypot(dx, dy) < CLICK_DISTANCE) {
      return
    }

    drag.moved = true
    drag.node.fx = (drag.node.fx ?? drag.node.x ?? 0) + dx / scale
    drag.node.fy = (drag.node.fy ?? drag.node.y ?? 0) + dy / scale
    drag.x = e.clientX
    drag.y = e.clientY
    drag.simulation.alphaTarget(0.3).restart()
  }

  const release = () => {
    if (!drag) {
      return
    }

    if (!drag.moved) {
      open(drag.node)
    }

    drag.node.fx = null
    drag.node.fy = null
    drag.simulation.alphaTarget(0)
    drag = null
  }

  const key = (e: KeyboardEvent, node: GraphNode) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      open(node)
    }
  }
</script>

<div class="relative flex min-h-0 flex-1 flex-col bg-base-200">
  {#if graph.nodes.length === 0}
    <div class="flex flex-1 items-center justify-center p-6">
      <div
        class={[
          "flex w-full max-w-md flex-col items-center gap-2 border",
          "border-dashed border-base-content/15 px-6 py-12 text-center",
        ]}
      >
        <Icon icon="lucide:waypoints" class="size-8 opacity-25" />
        <p class="font-medium">노트 없음</p>
        <p class="text-sm text-base-content/50">
          노트를 작성하고 [[링크]]로 서로 연결하세요.
        </p>
      </div>
    </div>
  {:else}
    <div class="min-h-0 flex-1">
      <Chart
        bind:context
        transform={{
          mode: "canvas",
          scrollMode: "scale",
          scaleExtent: [0.1, 8],
          clickDistance: CLICK_DISTANCE,
        }}
      >
        <Svg>
          <!-- ponytail: SVG re-renders every node per tick; switch to the Canvas layer past ~2000 notes -->
          <ForceSimulation {forces} data={graph}>
            {#snippet children({ nodes, links, linkPositions, simulation })}
              {#each links as link, i (i)}
                {@const at = linkPositions[i]}
                {#if at}
                  <line
                    x1={at.x1}
                    y1={at.y1}
                    x2={at.x2}
                    y2={at.y2}
                    class={[
                      "transition-opacity",
                      touches(link) ? "stroke-primary" : "stroke-base-content/15",
                      hovered !== null && !touches(link) && "opacity-20",
                    ]}
                  />
                {/if}
              {/each}

              {#each nodes as node (node.id)}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius(node)}
                  role="button"
                  tabindex="0"
                  aria-label={node.label}
                  class={[
                    "cursor-pointer outline-none transition-opacity",
                    near(node.id) ? "fill-primary" : "fill-base-content/60",
                    faded(node.id) && "opacity-20",
                  ]}
                  onpointerdown={e => press(e, node, simulation)}
                  onpointermove={move}
                  onpointerup={release}
                  onpointercancel={release}
                  onpointerenter={() => (hovered = node.id)}
                  onpointerleave={() => (hovered = null)}
                  onfocus={() => (hovered = node.id)}
                  onblur={() => (hovered = null)}
                  onkeydown={e => key(e, node)}
                />

                {#if labelled(node.id)}
                  <text
                    x={node.x}
                    y={(node.y ?? 0) + radius(node) + 10}
                    text-anchor="middle"
                    class={[
                      "pointer-events-none select-none fill-base-content text-xs",
                      "transition-opacity",
                      faded(node.id) && "opacity-20",
                    ]}
                  >
                    {node.label}
                  </text>
                {/if}
              {/each}
            {/snippet}
          </ForceSimulation>
        </Svg>
      </Chart>
    </div>

    <button
      class="btn btn-ghost btn-square btn-sm absolute top-3 right-3"
      aria-label="보기 초기화"
      onclick={() => context?.transform.reset()}
    >
      <Icon icon="lucide:scan" class="size-4" />
    </button>
  {/if}
</div>
