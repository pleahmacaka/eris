<script lang="ts">
  import type { GraphEdge, GraphRow } from "../../gitgraph"

  let { row, lanes }: { row: GraphRow; lanes: number } = $props()

  const LANE = 12
  const HEIGHT = 44
  const MIDDLE = HEIGHT / 2

  const COLORS = [
    "text-primary",
    "text-secondary",
    "text-accent",
    "text-info",
    "text-success",
    "text-warning",
  ]

  const x = (lane: number) => lane * LANE + LANE / 2

  const color = (lane: number) => COLORS[lane % COLORS.length]

  const span = (edge: GraphEdge) => {
    if (edge.half === "top") {
      return [0, MIDDLE]
    }

    return edge.half === "bottom" ? [MIDDLE, HEIGHT] : [0, HEIGHT]
  }

  const path = (edge: GraphEdge) => {
    const [top, bottom] = span(edge)
    const [from, to] = [x(edge.from), x(edge.to)]

    if (from === to) {
      return `M ${from} ${top} V ${bottom}`
    }

    const bend = (top + bottom) / 2

    return `M ${from} ${top} C ${from} ${bend} ${to} ${bend} ${to} ${bottom}`
  }
</script>

<svg
  class="h-full shrink-0"
  style:width="{lanes * 0.75}rem"
  viewBox="0 0 {lanes * LANE} {HEIGHT}"
  preserveAspectRatio="none"
  aria-hidden="true"
>
  {#each row.edges as edge, index (index)}
    <path
      class={color(edge.half === "bottom" ? edge.to : edge.from)}
      d={path(edge)}
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    />
  {/each}

  <circle
    class={color(row.lane)}
    cx={x(row.lane)}
    cy={MIDDLE}
    r="3.5"
    fill="currentColor"
  />
</svg>
