<script lang="ts">
import Icon from "@iconify/svelte"
import type { ClassValue } from "svelte/elements"
import type { ScreenId } from "#lib/landing/content.js"
import { SCREEN_ICONS } from "#lib/landing/icons.js"
import type { Copy } from "#lib/server/copy.js"

type Layout = "side" | "wrap" | "scroll"

type Props = {
  t: Copy["showcase"]
  active: ScreenId
  layout?: Layout
  class?: ClassValue
}

let {
  t,
  active = $bindable(),
  layout = "wrap",
  class: className,
}: Props = $props()

const LIST: Record<Layout, string> = {
  side: "flex-wrap lg:w-48 lg:shrink-0 lg:flex-col lg:flex-nowrap",
  wrap: "flex-wrap",
  scroll: "max-sm:scrollbar-none max-sm:overflow-x-auto sm:flex-wrap",
}

const TAB: Record<Layout, string> = {
  side: "lg:justify-start",
  wrap: "",
  scroll: "max-sm:shrink-0",
}

let list = $state<HTMLFieldSetElement>()

$effect(() => {
  if (layout === "scroll") {
    list
      ?.querySelector(`[data-screen="${active}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center" })
  }
})
</script>

<fieldset bind:this={list} class={["flex min-w-0 gap-1", LIST[layout], className]}>
  <legend class="sr-only">{t.tabs}</legend>

  {#each t.screens as screen (screen.id)}
    <button
      type="button"
      data-screen={screen.id}
      aria-pressed={active === screen.id}
      class={[
        "btn btn-sm btn-ghost",
        TAB[layout],
        active === screen.id && "btn-active",
      ]}
      onclick={() => (active = screen.id)}
    >
      <Icon icon={SCREEN_ICONS[screen.id]} class="size-4 shrink-0" />
      <span class="min-w-0 truncate">{screen.name}</span>
    </button>
  {/each}
</fieldset>
