<script lang="ts">
  import Icon from "@iconify/svelte"
  import { fly } from "svelte/transition"
  import { rem } from "$lib/ascii/motion"
  import { closeMenu, type MenuAction, menu } from "$lib/menu/menu.svelte"

  let width = $state(0)
  let height = $state(0)

  const at = $derived(menu.at)

  const left = $derived(
    at ? Math.max(4, Math.min(at.x, innerWidth - width - 4)) / rem(1) : 0,
  )

  const top = $derived(
    at ? Math.max(4, Math.min(at.y, innerHeight - height - 4)) / rem(1) : 0,
  )

  const pick = (item: MenuAction) => {
    if (item.disabled) {
      return
    }

    closeMenu()
    Promise.resolve(item.run()).catch(() => undefined)
  }

  const start = (node: HTMLElement) => {
    node.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus()
  }

  const keys = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      closeMenu()

      return
    }

    const list = event.currentTarget as HTMLElement
    const all = [
      ...list.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    ]
    const index = all.findIndex(item => item === document.activeElement)
    const moves: Record<string, number> = {
      ArrowDown: (index + 1) % all.length,
      ArrowUp: (index - 1 + all.length) % all.length,
      Home: 0,
      End: all.length - 1,
    }

    if (event.key in moves) {
      event.preventDefault()
      all[moves[event.key]]?.focus()
    }
  }
</script>

<svelte:window onblur={closeMenu} onresize={closeMenu} />

{#if at}
  <div
    class="fixed inset-0 z-80"
    role="presentation"
    oncontextmenu={e => {
      e.preventDefault()
      closeMenu()
    }}
    onpointerdown={closeMenu}
  ></div>

  <menu
    role="menu"
    tabindex="-1"
    class={[
      "fixed z-80 min-w-52 border border-base-content/12 bg-base-100 p-1",
      "text-sm shadow-lg shadow-base-300/40 outline-none",
    ]}
    style:left="{left}rem"
    style:top="{top}rem"
    bind:clientWidth={width}
    bind:clientHeight={height}
    onkeydown={keys}
    use:start
    transition:fly={{ y: -4, duration: 120 }}
  >
    {#each at.items as item, index (index)}
      {#if item === "separator"}
        <li role="separator" class="mx-2 my-1 border-t border-dashed border-base-content/12"></li>
      {:else}
        <li role="none">
          <button
            role="menuitem"
            disabled={item.disabled}
            class={[
              "flex h-8 w-full cursor-pointer items-center gap-2.5 px-2 text-left",
              "transition-colors hover:bg-primary/12 focus-visible:bg-primary/12",
              "focus-visible:outline-none disabled:cursor-not-allowed",
              "disabled:opacity-40 disabled:hover:bg-transparent",
              item.danger && "text-error hover:bg-error/10",
            ]}
            onclick={() => pick(item)}
          >
            {#if item.icon}
              <Icon icon={item.icon} class="size-4 shrink-0 opacity-70" />
            {:else}
              <span class="size-4 shrink-0"></span>
            {/if}
            <span class="flex-1 truncate">{item.label}</span>
            {#if item.keys}
              <span class="shrink-0 pl-4 text-xs text-base-content/40 tabular">
                {item.keys}
              </span>
            {/if}
          </button>
        </li>
      {/if}
    {/each}
  </menu>
{/if}
