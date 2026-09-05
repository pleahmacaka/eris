<script lang="ts">
  import Icon from "@iconify/svelte"
  import { isAction, type MenuItem } from "./menu"

  type Props = {
    items: MenuItem[]
    open: boolean
    x?: number
    y?: number
    placement?: "up" | "down"
    align?: "start" | "end"
    bottom?: number
    width?: number
    label?: string
    onclose?: () => void
    onsize?: (height: number) => void
  }

  let {
    items,
    open = $bindable(),
    x,
    y,
    placement = "up",
    align = "start",
    bottom,
    width = 224,
    label = "Menu",
    onclose,
    onsize,
  }: Props = $props()

  const EDGE = 6

  let list = $state<HTMLElement>()
  let cursor = $state(-1)
  let left = $state(0)
  let top = $state(0)
  let viewportWidth = $state(0)
  let viewportHeight = $state(0)

  const floating = $derived(x !== undefined && (y !== undefined || bottom !== undefined))

  const actions = $derived(items.filter(isAction))

  const close = () => {
    open = false
    cursor = -1
    onclose?.()
  }

  const run = (item: MenuItem) => {
    if (!isAction(item) || item.disabled) {
      return
    }

    close()
    Promise.resolve(item.action()).catch(() => undefined)
  }

  const step = (delta: number) => {
    if (actions.length === 0) {
      return
    }

    const enabled = actions.filter(a => !a.disabled)

    if (enabled.length === 0) {
      return
    }

    const current = enabled.findIndex(a => a === actions[cursor])
    const next = (current + delta + enabled.length) % enabled.length

    cursor = actions.indexOf(enabled[next])
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (!open) {
      return
    }

    if (e.key === "Escape") {
      e.preventDefault()

      return close()
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()

      return step(e.key === "ArrowDown" ? 1 : -1)
    }

    if (e.key === "Enter" && cursor >= 0) {
      e.preventDefault()
      run(actions[cursor])
    }
  }

  const onmousedown = (e: MouseEvent) => {
    if (open && list && !list.contains(e.target as Node)) {
      close()
    }
  }

  $effect(() => {
    if (!open || !list) {
      return
    }

    const height = list.offsetHeight

    onsize?.(height)

    if (!floating) {
      return
    }

    const box = list.getBoundingClientRect()

    left = Math.min(Math.max(EDGE, x ?? 0), viewportWidth - box.width - EDGE)

    if (bottom !== undefined) {
      top = Math.max(EDGE, viewportHeight - bottom - box.height)

      return
    }

    const above = (y ?? 0) - box.height
    const below = y ?? 0

    top =
      placement === "up" && above >= EDGE
        ? above
        : Math.min(below, viewportHeight - box.height - EDGE)
  })
</script>

<svelte:window
  {onkeydown}
  {onmousedown}
  bind:innerWidth={viewportWidth}
  bind:innerHeight={viewportHeight}
/>

{#if open}
  <ul
    bind:this={list}
    role="menu"
    aria-label={label}
    class={[
      "menu z-50 gap-0.5 rounded-box border border-base-content/10 bg-base-100/95 p-2 shadow-2xl backdrop-blur-xl",
      floating
        ? "fixed"
        : placement === "up"
          ? "absolute bottom-full mb-2"
          : "absolute top-full mt-2",
      !floating && (align === "end" ? "right-0" : "left-0"),
    ]}
    style:width="{width}px"
    style:left={floating ? `${left}px` : undefined}
    style:top={floating ? `${top}px` : undefined}
  >
    {#each items as item, index (isAction(item) ? item.label : index)}
      {#if item === "separator"}
        <li class="mx-1 my-1.5 border-t border-base-content/10" role="separator"></li>
      {:else}
        <li role="none" class={[item.disabled && "menu-disabled"]}>
          <button
            role="menuitem"
            type="button"
            class={[
              "min-h-9 gap-2.5 rounded-field px-3 py-2 text-sm",
              index === cursor && !item.disabled && "menu-active",
            ]}
            disabled={item.disabled}
            tabindex="-1"
            onmousemove={() => (cursor = index)}
            onclick={() => run(item)}
          >
            {#if item.icon}
              <Icon icon={item.icon} class="size-4 shrink-0 text-base-content/60" />
            {/if}

            <span class="truncate">{item.label}</span>

            {#if item.hint}
              <span class="ml-auto shrink-0 text-xs text-base-content/40">
                {item.hint}
              </span>
            {/if}
          </button>
        </li>
      {/if}
    {/each}
  </ul>
{/if}
