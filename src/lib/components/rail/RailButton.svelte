<script lang="ts">
import type { Snippet } from "svelte"
import { scale } from "svelte/transition"
import { contextMenu } from "#lib/attachments/contextMenu.js"
import type { MenuSection } from "#lib/menu/items.js"
import { duration, QUICK_MS, SHAPE_MS } from "#lib/motion/durations.js"

type Tone = "space" | "brand" | "action"

type Props = {
  label: string
  selected?: boolean
  unread?: boolean
  highlight?: number
  tone?: Tone
  menu?: () => MenuSection[]
  onclick: () => void
  children: Snippet
}

const IDLE: Record<Tone, string> = {
  space: "bg-base-100 hover:bg-primary hover:text-primary-content",
  brand: "bg-base-100 text-primary hover:bg-primary hover:text-primary-content",
  action:
    "bg-base-100 text-success hover:bg-success hover:text-success-content",
}

let {
  label,
  selected = false,
  unread = false,
  highlight = 0,
  tone = "space",
  menu,
  onclick,
  children,
}: Props = $props()

const morph = $derived(`${duration(SHAPE_MS)}ms`)
</script>

<div
  class="group relative flex w-full justify-center"
  transition:scale={{ start: 0.6, duration: duration(QUICK_MS) }}
>
  <span
    class={[
      "absolute start-0 top-1/2 w-1 origin-left -translate-y-1/2 rounded-e-full",
      "bg-base-content transition-[height,scale,opacity] ease-out rtl:origin-right",
      selected
        ? "h-10"
        : unread
          ? "h-2 group-hover:h-5"
          : [
              "h-2 scale-x-0 opacity-0",
              "group-hover:h-5 group-hover:scale-x-100 group-hover:opacity-100",
            ],
    ]}
    style:transition-duration={morph}
    aria-hidden="true"
  ></span>

  <button
    type="button"
    class={[
      "flex size-12 cursor-pointer items-center justify-center overflow-hidden",
      "font-bold text-lg ease-out",
      "transition-[border-radius,background-color,color]",
      selected
        ? "rounded-[30%] bg-primary text-primary-content"
        : ["rounded-[50%] hover:rounded-[30%]", IDLE[tone]],
    ]}
    style:transition-duration={morph}
    aria-label={label}
    title={label}
    aria-pressed={selected}
    {onclick}
    {@attach menu && contextMenu(menu)}
  >
    {@render children()}
  </button>

  {#if highlight > 0}
    <span
      class={[
        "badge badge-error badge-xs absolute -end-0.5 -bottom-0.5",
        "whitespace-nowrap tabular-nums",
      ]}
    >
      {highlight > 99 ? "99+" : highlight}
    </span>
  {/if}
</div>
