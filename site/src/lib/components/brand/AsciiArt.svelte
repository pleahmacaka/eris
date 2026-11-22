<script lang="ts">
import type { ClassValue } from "svelte/elements"
import { asciiField } from "#lib/attachments/asciiField.js"
import {
  type AsciiArt,
  CELL_ASPECT,
  GLYPH_SCALE,
  GLYPH_WEIGHT,
} from "#lib/brand/ascii.js"
import { TOKEN_FILL } from "#lib/brand/fill.js"

type Props = { art: AsciiArt; interactive?: boolean; class?: ClassValue }

let { art, interactive = false, class: className }: Props = $props()

const CELL = 10
const ROW = CELL * CELL_ASPECT

const lines = $derived(
  art.layers.flatMap(layer =>
    layer.rows.flatMap((row, index) => {
      const glyphs = [...row].flatMap((glyph, col) =>
        glyph === " " ? [] : [{ glyph, x: (col + 0.5) * CELL }],
      )

      if (glyphs.length === 0) {
        return []
      }

      return [{ fill: TOKEN_FILL[layer.token], y: (index + 0.5) * ROW, glyphs }]
    }),
  ),
)
</script>

<svg
  viewBox="0 0 {art.cols * CELL} {art.rows * ROW}"
  class={["select-none", interactive && "cursor-crosshair touch-pan-y", className]}
  font-size={ROW * GLYPH_SCALE}
  font-weight={GLYPH_WEIGHT}
  text-anchor="middle"
  aria-hidden="true"
  {@attach interactive && asciiField}
>
  {#if interactive}
    <rect width={art.cols * CELL} height={art.rows * ROW} fill="transparent" />

    {#each lines as line}
      {#each line.glyphs as item}
        <text
          x={item.x}
          y={line.y}
          data-glyph={item.glyph}
          dominant-baseline="central"
          class={line.fill}>{item.glyph}</text
        >
      {/each}
    {/each}
  {:else}
    {#each lines as line}
      <text
        x={line.glyphs.map(item => item.x).join(" ")}
        y={line.y}
        dominant-baseline="central"
        class={line.fill}
      >
        {line.glyphs.map(item => item.glyph).join("")}
      </text>
    {/each}
  {/if}
</svg>
