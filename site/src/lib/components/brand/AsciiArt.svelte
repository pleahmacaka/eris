<script lang="ts">
import type { ClassValue } from "svelte/elements"
import {
  type AsciiArt,
  CELL_ASPECT,
  GLYPH_SCALE,
  GLYPH_WEIGHT,
} from "#lib/brand/ascii.js"
import { TOKEN_FILL } from "#lib/brand/fill.js"

type Props = { art: AsciiArt; class?: ClassValue }

let { art, class: className }: Props = $props()

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

      return [
        {
          fill: TOKEN_FILL[layer.token],
          y: (index + 0.5) * ROW,
          x: glyphs.map(item => item.x).join(" "),
          text: glyphs.map(item => item.glyph).join(""),
        },
      ]
    }),
  ),
)
</script>

<svg
  viewBox="0 0 {art.cols * CELL} {art.rows * ROW}"
  class={["select-none", className]}
  font-size={ROW * GLYPH_SCALE}
  font-weight={GLYPH_WEIGHT}
  text-anchor="middle"
  aria-hidden="true"
>
  {#each lines as line}
    <text x={line.x} y={line.y} dominant-baseline="central" class={line.fill}>
      {line.text}
    </text>
  {/each}
</svg>
