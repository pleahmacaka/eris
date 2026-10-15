<script lang="ts">
  import Icon from "@iconify/svelte"
  import { SvelteMap, SvelteSet } from "svelte/reactivity"
  import { t } from "svelte-i18n"
  import { findBytes, readBytes } from "../../native"

  let { path, size }: { path: string; size: number } = $props()

  const ROW_REM = 1.25
  const PAGE = 4096
  const DIGITS = "0123456789abcdef"

  const pages = new SvelteMap<number, Uint8Array>()
  const loading = new SvelteSet<number>()

  let viewport = $state<HTMLElement>()
  let width = $state(0)
  let height = $state(0)
  let top = $state(0)
  let query = $state("")
  let match = $state<{ at: number; length: number } | null>(null)
  let missing = $state(false)
  let searching = $state(false)

  const rem = () =>
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

  const perRow = $derived(width / rem() >= 32 ? 16 : 8)
  const rowPx = $derived(ROW_REM * rem())
  const rows = $derived(Math.ceil(size / perRow))
  const digits = $derived(size > 0xffffff ? 8 : 6)
  const first = $derived(Math.max(0, Math.floor(top / rowPx) - 2))
  const last = $derived(Math.min(rows, Math.ceil((top + height) / rowPx) + 2))

  const visible = $derived(
    Array.from({ length: Math.max(0, last - first) }, (_, index) => first + index),
  )

  const isHex = (text: string) => {
    const compact = text.replaceAll(" ", "").toLowerCase()

    return (
      compact.length >= 2 &&
      compact.length % 2 === 0 &&
      [...compact].every(char => DIGITS.includes(char))
    )
  }

  const needle = $derived.by(() => {
    if (!query.trim()) {
      return []
    }

    if (!isHex(query)) {
      return [...new TextEncoder().encode(query)]
    }

    const compact = query.replaceAll(" ", "")

    return Array.from({ length: compact.length / 2 }, (_, index) =>
      Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16),
    )
  })

  const byteAt = (offset: number) =>
    pages.get(Math.floor(offset / PAGE))?.[offset % PAGE]

  const hexOf = (value: number | undefined) =>
    value === undefined ? "··" : value.toString(16).padStart(2, "0")

  const charOf = (value: number | undefined) =>
    value === undefined
      ? " "
      : value >= 0x20 && value < 0x7f
        ? String.fromCharCode(value)
        : "."

  const hit = (offset: number) =>
    !!match && offset >= match.at && offset < match.at + match.length

  $effect(() => {
    const from = Math.floor((first * perRow) / PAGE)
    const to = Math.floor(Math.max(last * perRow - 1, 0) / PAGE)
    const target = path

    for (let page = from; page <= to && page * PAGE < size; page += 1) {
      if (pages.has(page) || loading.has(page)) {
        continue
      }

      loading.add(page)
      readBytes(target, page * PAGE, PAGE)
        .then(bytes => pages.set(page, bytes))
        .catch(() => undefined)
        .finally(() => loading.delete(page))
    }
  })

  const search = async () => {
    if (needle.length === 0 || searching) {
      return
    }

    searching = true

    const from = match ? match.at + 1 : 0
    const at = await findBytes(path, needle, from).catch(() => null)

    searching = false
    missing = at === null
    match = at === null ? null : { at, length: needle.length }

    if (at !== null && viewport) {
      viewport.scrollTop = Math.max(0, Math.floor(at / perRow) * rowPx - height / 3)
    }
  }
</script>

<div class="flex size-full min-h-0 flex-col gap-2 self-stretch p-2 text-xs">
  <label class="input input-sm w-full shrink-0">
    <Icon icon="lucide:search" class="size-3.5 shrink-0 opacity-50" />

    <input
      type="search"
      spellcheck="false"
      placeholder={$t("explorer.hex.search")}
      aria-label={$t("explorer.hex.search")}
      bind:value={query}
      oninput={() => {
        match = null
        missing = false
      }}
      onkeydown={e => {
        if (e.key === "Enter") {
          e.preventDefault()
          search()
        }
      }}
    />

    {#if query.trim()}
      <span class="shrink-0 text-base-content/50">
        {$t(isHex(query) ? "explorer.hex.modeHex" : "explorer.hex.modeText")}
      </span>
    {/if}
  </label>

  {#if missing}
    <span class="shrink-0 px-1 text-base-content/50">{$t("explorer.hex.notFound")}</span>
  {/if}

  <div
    bind:this={viewport}
    bind:clientWidth={width}
    bind:clientHeight={height}
    class="relative min-h-0 grow overflow-auto tabular-nums"
    onscroll={e => (top = e.currentTarget.scrollTop)}
  >
    <div class="relative" style:height="{rows * ROW_REM}rem">
      {#each visible as row (row)}
        {@const base = row * perRow}

        <div
          class="absolute inset-x-0 flex h-5 items-center gap-1.5 whitespace-nowrap"
          style:top="{row * ROW_REM}rem"
        >
          <span class={["shrink-0 text-base-content/40", digits > 6 ? "w-14" : "w-11"]}>
            {base.toString(16).padStart(digits, "0")}
          </span>

          <span class="flex shrink-0">
            {#each { length: perRow } as _, column}
              {@const offset = base + column}

              <span
                class={[
                  "w-4 text-center",
                  offset >= size && "invisible",
                  hit(offset) && "rounded-sm bg-primary/30 text-primary",
                ]}
              >
                {hexOf(byteAt(offset))}
              </span>
            {/each}
          </span>

          <span class="flex shrink-0 text-base-content/60">
            {#each { length: perRow } as _, column}
              {@const offset = base + column}

              <span
                class={[
                  "w-2 text-center",
                  offset >= size && "invisible",
                  hit(offset) && "bg-primary/30 text-primary",
                ]}
              >
                {charOf(byteAt(offset))}
              </span>
            {/each}
          </span>
        </div>
      {/each}
    </div>
  </div>
</div>
