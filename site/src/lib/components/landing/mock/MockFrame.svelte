<script module lang="ts">
import { getContext, setContext } from "svelte"

type Frame = { readonly fill: boolean }

const KEY = Symbol("mockFrame")

export const useMockFrame = () => getContext<Frame>(KEY)
</script>

<script lang="ts">
import type { Snippet } from "svelte"

type Props = {
  label: string
  fill?: boolean
  live?: boolean
  children: Snippet
}

let { label, fill = false, live = false, children }: Props = $props()

setContext<Frame>(KEY, {
  get fill() {
    return fill
  },
})
</script>

<div
  role={live ? "group" : "img"}
  aria-label={label}
  class={["@container", fill && "h-full"]}
>
  <div
    inert={!live}
    aria-hidden={live ? undefined : true}
    class={[
      "relative isolate flex overflow-hidden border",
      "border-base-content/15 bg-base-100 text-start text-sm",
      live ? "max-sm:border-x-0 sm:rounded-field" : "select-none rounded-field",
      fill ? "h-full" : "aspect-4/5 @sm:aspect-4/3 @2xl:aspect-16/10",
    ]}
  >
    {@render children()}
  </div>
</div>
