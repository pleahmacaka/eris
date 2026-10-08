<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Snippet } from "svelte"
  import { prefetchOnHover } from "../../store/prefetch"
  import { middleClick } from "../middleClick"
  import ItemIcon from "../items/ItemIcon.svelte"

  let {
    label,
    location,
    active,
    nested = false,
    icon = null,
    onopen,
    onaux,
    onmenu,
    onpress,
    children,
  }: {
    label: string
    location: string
    active: boolean
    nested?: boolean
    icon?: string | null
    onopen: () => void
    onaux: () => void
    onmenu: (e: MouseEvent) => void
    onpress?: (e: PointerEvent) => void
    children?: Snippet
  } = $props()
</script>

<button
  type="button"
  title={label}
  data-drop-path={location}
  {@attach prefetchOnHover(location)}
  {@attach middleClick(onaux)}
  class={[
    "flex w-full cursor-pointer flex-col gap-1 rounded-field py-1.5 pr-2",
    "text-left text-sm transition-colors",
    nested ? "pl-7" : "pl-2",
    active ? "bg-base-content/10 font-medium" : "hover:bg-base-content/5",
  ]}
  onclick={onopen}
  onpointerdown={onpress}
  oncontextmenu={onmenu}
>
  <span class="flex min-w-0 items-center gap-2">
    {#if icon}
      <Icon {icon} class="size-4 shrink-0 text-primary" />
    {:else}
      <ItemIcon source={location} rem={1} class="size-4 shrink-0" />
    {/if}

    <span class="min-w-0 truncate">{label}</span>
  </span>

  {@render children?.()}
</button>
