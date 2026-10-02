<script lang="ts">
  import { currentLocale } from "@eris/i18n"
  import { t } from "svelte-i18n"
  import { formatBytes } from "../../format"
  import { displayName, type Item } from "../../items"
  import { HIDDEN } from "../../locations"
  import type { Explorer } from "../../store/explorer.svelte"
  import { openMenu } from "../../store/menus"
  import { prefetchOnHover } from "../../store/prefetch"
  import { prefs, SORT_KEYS } from "../../store/prefs.svelte"
  import { cellText, kindText } from "./cells"
  import ItemIcon from "./ItemIcon.svelte"
  import RenameField from "./RenameField.svelte"

  let {
    explorer,
    item,
    icon,
    template,
    onpress,
  }: {
    explorer: Explorer
    item: Item
    icon: number
    template: string
    onpress: (item: Item, e: PointerEvent) => void
  } = $props()

  const tab = $derived(explorer.tab)
  const view = $derived(explorer.view)
  const results = $derived(!!tab.results)
  const selected = $derived(tab.selection.has(item.key))

  const usage = $derived(
    item.drive && item.drive.total > 0
      ? (item.drive.total - item.drive.free) / item.drive.total
      : 0,
  )

  const stemOf = (shown: string) => {
    const dot = shown.lastIndexOf(".")

    return !item.dir && shown === item.name && dot > 0 ? dot : shown.length
  }
</script>

{#snippet name(multiline: boolean)}
  {@const shown = displayName(item, prefs.showExtensions)}

  {#if tab.renaming === item.key}
    <RenameField
      value={shown}
      stem={stemOf(shown)}
      {multiline}
      oncommit={draft => explorer.commitRename(item, draft)}
      oncancel={() => (tab.renaming = null)}
    />
  {:else}
    <span
      class={[
        "min-w-0",
        multiline ? "line-clamp-2 text-center break-all" : "truncate",
      ]}
    >
      {shown}
    </span>
  {/if}
{/snippet}

<div
  role="row"
  tabindex="-1"
  data-key={item.key}
  {@attach prefetchOnHover(item.dir ? item.path : null)}
  aria-selected={selected}
  title={view === "details" ? undefined : item.name}
  class={[
    "min-w-0 cursor-default rounded-field outline-none",
    selected ? "bg-primary/20" : "hover:bg-base-content/5",
    tab.focus === item.key && "ring-1 ring-primary/50 ring-inset",
    explorer.dropKey === item.key &&
      "bg-primary/25 ring-2 ring-primary ring-inset",
    (item.attrs & HIDDEN) !== 0 && "opacity-60",
    view === "details" && "mx-1 grid items-center text-sm",
    (view === "list" || view === "small") &&
      "mx-0.5 flex items-center gap-2 px-2 text-sm",
    view === "tiles" && "m-0.5 flex items-center gap-3 px-2",
    (view === "medium" || view === "large") &&
      "m-0.5 flex flex-col items-center gap-1 px-1 pt-2 text-xs",
  ]}
  style:grid-template-columns={view === "details" ? template : undefined}
  onpointerdown={e => {
    e.stopPropagation()
    onpress(item, e)
  }}
  ondblclick={() => explorer.open(item)}
  oncontextmenu={e => {
    e.stopPropagation()
    openMenu(explorer, e, item)
  }}
  onkeydown={() => undefined}
>
  {#if view === "details"}
    <div class="flex min-w-0 items-center gap-2 px-2">
      <ItemIcon source={item} rem={1} class="size-4 shrink-0" />

      {@render name(false)}
    </div>

    {#each SORT_KEYS.slice(1) as key (key)}
      <span
        class={[
          "truncate px-3 text-xs text-base-content/60",
          key === "size" && "text-right",
        ]}
        title={key === "kind" && results ? (item.parent ?? "") : undefined}
      >
        {cellText(item, key, results)}
      </span>
    {/each}
  {:else if view === "tiles"}
    <ItemIcon source={item} rem={3} thumbnail class="size-12 shrink-0" />

    <div class="flex min-w-0 grow flex-col gap-0.5">
      <div class="flex min-w-0 text-sm">
        {@render name(false)}
      </div>

      {#if item.drive && item.drive.total > 0}
        <progress
          class={[
            "progress h-1.5 w-full",
            usage > 0.9 ? "progress-error" : "progress-primary",
          ]}
          value={usage}
          max="1"
        ></progress>

        <span class="truncate text-xs text-base-content/60">
          {$t("explorer.drive.free", {
            values: {
              free: formatBytes(item.drive.free, currentLocale()),
              total: formatBytes(item.drive.total, currentLocale()),
            },
          })}
        </span>
      {:else if item.drive}
        <span class="truncate text-xs text-base-content/60">
          {item.drive.connected ? item.kind : $t("explorer.drive.disconnected")}
        </span>
      {:else}
        <span class="truncate text-xs text-base-content/60">
          {kindText(item, results)}
        </span>

        {#if !item.dir}
          <span class="truncate text-xs text-base-content/50">
            {formatBytes(item.size, currentLocale())}
          </span>
        {/if}
      {/if}
    </div>
  {:else if view === "list" || view === "small"}
    <ItemIcon source={item} rem={1} class="size-4 shrink-0" />

    {@render name(false)}
  {:else}
    <ItemIcon
      source={item}
      rem={icon}
      thumbnail
      class={[view === "large" ? "size-24" : "size-12", "shrink-0"]}
    />

    <div class="flex w-full min-w-0 justify-center">
      {@render name(true)}
    </div>
  {/if}
</div>
