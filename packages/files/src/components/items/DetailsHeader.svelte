<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import type { Item } from "../../items"
  import { resizeHandle, rootRem } from "@eris/ui"
  import type { Explorer } from "../../store/explorer.svelte"
  import { prefs, SORT_KEYS, type SortKey } from "../../store/prefs.svelte"
  import { cellText } from "./cells"

  let {
    explorer,
    template,
    width,
    shown,
  }: {
    explorer: Explorer
    template: string
    width: number
    shown: Item[]
  } = $props()

  const COLUMN_MIN = 4
  const COLUMN_MAX = 60

  const results = $derived(!!explorer.tab.results)

  let measurer: CanvasRenderingContext2D | null = null

  const label = (key: SortKey) =>
    key === "kind" && results
      ? $t("explorer.columns.folder")
      : $t(`explorer.columns.${key}`)

  const textWidth = (text: string, size: number) => {
    const rem = rootRem()

    measurer ??= document.createElement("canvas").getContext("2d")

    if (!measurer || !text) {
      return 0
    }

    measurer.font = `${size * rem}px ${getComputedStyle(document.body).fontFamily}`

    return measurer.measureText(text).width / rem
  }

  const fit = (key: SortKey) => {
    const name = key === "name"
    const chrome = name ? 2.5 : 1.5
    const size = name ? 0.875 : 0.75
    const cells = shown.map(
      item => textWidth(cellText(item, key, results), size) + chrome,
    )
    const heading = textWidth(label(key), 0.75) + 2.5
    const wanted = Math.ceil(Math.max(heading, ...cells) * 4) / 4

    prefs.columns[key] = Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, wanted))
  }

  const resize = (key: SortKey) =>
    resizeHandle({
      axis: "x",
      min: COLUMN_MIN,
      max: COLUMN_MAX,
      get: () => prefs.columns[key],
      set: size => (prefs.columns[key] = size),
    })
</script>

<div
  role="row"
  class={[
    "sticky top-0 z-10 grid h-8 items-stretch border-b border-base-content/10",
    "bg-base-100 text-xs text-base-content/60",
  ]}
  style:grid-template-columns={template}
  style:width="{width}rem"
>
  {#each SORT_KEYS as key (key)}
    <div role="columnheader" class="relative flex min-w-0">
      <button
        type="button"
        class={[
          "flex min-w-0 grow cursor-pointer items-center gap-1 px-3",
          "hover:bg-base-content/5",
          key === "size" && "justify-end",
        ]}
        onclick={() => explorer.setSort(key)}
      >
        <span class="truncate">{label(key)}</span>

        {#if explorer.folder.sort === key}
          <Icon
            icon={explorer.folder.ascending
              ? "lucide:chevron-up"
              : "lucide:chevron-down"}
            class="size-3 shrink-0"
          />
        {/if}
      </button>

      <div
        role="separator"
        aria-orientation="vertical"
        class={[
          "absolute top-1.5 -right-0.5 bottom-1.5 z-10 w-1 cursor-col-resize",
          "rounded-full hover:bg-primary/40",
        ]}
        onpointerdown={resize(key)}
        ondblclick={() => fit(key)}
      ></div>
    </div>
  {/each}
</div>
