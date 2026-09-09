<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { type Launcher, MENU_WIDTH } from "./launcher.svelte"
  import { kindLabel, type Result } from "@eris/launcher-core"

  let {
    launcher,
    item,
    index,
  }: { launcher: Launcher; item: Result; index: number } = $props()

  const active = $derived(index === launcher.active)
</script>

<div
  role="option"
  aria-selected={active}
  data-index={index}
  tabindex="-1"
  class={[
    "group flex items-center gap-2 rounded-field px-2 transition-colors duration-150",
    launcher.compact ? "py-1" : "py-1.5",
    active
      ? "bg-primary/15 ring-1 ring-primary/30 ring-inset"
      : "hover:bg-base-content/5",
  ]}
  onmousemove={() => (launcher.cursor = index)}
  oncontextmenu={e => {
    e.preventDefault()
    launcher.openMenu(index, e.clientX, e.clientY)
  }}
>
  <button
    type="button"
    class="flex min-w-0 grow items-center gap-3 text-left"
    tabindex="-1"
    onclick={() => launcher.run(item)}
  >
    <span
      class="flex size-9 shrink-0 items-center justify-center rounded-selector bg-base-content/5"
    >
      {#if item.kind === "emoji"}
        <span class="text-2xl leading-none">{item.icon}</span>
      {:else if item.icon.startsWith("data:")}
        <img src={item.icon} alt="" class="size-6" />
      {:else}
        <Icon icon={item.icon} class="size-5 text-base-content/80" />
      {/if}
    </span>

    <span class="min-w-0 grow">
      <span class="flex items-center gap-2">
        <span class="truncate font-medium">{item.title}</span>

        {#each item.chips ?? [] as chip}
          <span class="badge badge-ghost badge-xs shrink-0">{chip}</span>
        {/each}
      </span>

    </span>
  </button>

  {#if index < 9 && launcher.device.showKeymap}
    <kbd
      class={[
        "kbd kbd-xs shrink-0 transition-opacity duration-150",
        active ? "opacity-60" : "opacity-0 group-hover:opacity-40",
      ]}
    >
      Alt {index + 1}
    </kbd>
  {/if}

  <span class="badge badge-ghost badge-sm shrink-0">
    {kindLabel(item.kind)}
  </span>

  <button
    type="button"
    class={[
      "btn btn-circle btn-ghost btn-xs shrink-0 transition-opacity duration-150",
      active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
    ]}
    aria-label={$t("launcher.moreActions")}
    tabindex="-1"
    onclick={e => {
      e.stopPropagation()

      const rect = e.currentTarget.getBoundingClientRect()

      launcher.openMenu(index, rect.right - MENU_WIDTH, rect.bottom + 4)
    }}
  >
    <Icon icon="lucide:ellipsis" class="size-4" />
  </button>
</div>
