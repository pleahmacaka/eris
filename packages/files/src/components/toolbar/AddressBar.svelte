<script lang="ts">
  import Icon from "@iconify/svelte"
  import { openContextMenu, toast } from "@eris/ui"
  import { tick } from "svelte"
  import { t } from "svelte-i18n"
  import {
    isUnc,
    isVirtual,
    sameLocation,
    segments,
    THIS_PC,
  } from "../../locations"
  import { openItem, runAddress } from "../../native"
  import type { Explorer } from "../../store/explorer.svelte"
  import { prefetchOnHover } from "../../store/prefetch"
  import {
    driveName,
    NAMED_PLACES,
    places,
  } from "../../store/places.svelte"

  let { explorer }: { explorer: Explorer } = $props()

  const OVERFLOW_WIDTH = 32
  const EDIT_ROOM = 40

  let editing = $state(false)
  let draft = $state("")
  let field = $state<HTMLInputElement>()
  let barWidth = $state(0)
  let widths = $state<number[]>([])

  const tab = $derived(explorer.tab)

  const named = $derived(
    NAMED_PLACES.map(([path, key]) => ({ name: $t(key), path })),
  )

  const thisPc = $derived(named.find(entry => entry.path === THIS_PC))

  const crumbs = $derived.by(() => {
    const location = tab.location
    const known = named.find(entry => entry.path === location)

    if (known) {
      return [known]
    }

    if (isVirtual(location)) {
      return [{ name: tab.shellName || location, path: location }]
    }

    const parts = segments(location).map((part, index) => {
      const drive =
        index === 0
          ? places.drives.find(drive => sameLocation(drive.path, part.path))
          : undefined

      return drive ? { name: driveName(drive, $t), path: part.path } : part
    })

    return isUnc(location) || !thisPc ? parts : [thisPc, ...parts]
  })

  const hidden = $derived.by(() => {
    const room = barWidth - EDIT_ROOM

    if (widths.length !== crumbs.length || widths.reduce((a, b) => a + b, 0) <= room) {
      return 0
    }

    let used = OVERFLOW_WIDTH
    let shown = 0

    for (let index = crumbs.length - 1; index >= 0; index--) {
      if (shown > 0 && used + widths[index] > room) {
        break
      }

      used += widths[index]
      shown++
    }

    return crumbs.length - shown
  })

  const showHidden = (e: MouseEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()

    openContextMenu({
      x: box.left,
      y: box.bottom + 4,
      placement: "down",
      items: crumbs
        .slice(0, hidden)
        .reverse()
        .map(crumb => ({
          label: crumb.name,
          icon: "lucide:folder",
          action: () => explorer.go(crumb.path),
        })),
    })
  }

  const measure = (node: HTMLElement) => {
    const update = () => {
      widths = [...node.children].map(child => child.getBoundingClientRect().width)
    }

    const observer = new ResizeObserver(update)

    observer.observe(node)
    update()

    return () => observer.disconnect()
  }

  export const edit = async () => {
    draft = isVirtual(tab.location)
      ? (crumbs.at(-1)?.name ?? "")
      : tab.location
    editing = true

    await tick()
    field?.focus()
    field?.select()
  }

  const submit = async () => {
    const text = draft.trim()

    editing = false

    if (!text || text === crumbs.at(-1)?.name) {
      return
    }

    const alias = named.find(
      entry => entry.name.toLowerCase() === text.toLowerCase(),
    )

    if (alias) {
      return explorer.go(alias.path)
    }

    const cwd = isVirtual(tab.location) ? null : tab.location
    const found = await runAddress(text, cwd).catch(() => undefined)

    if (found === undefined) {
      return toast($t("explorer.errors.missing"), "error")
    }

    if (!found) {
      return
    }

    if (found.file && found.select) {
      return openItem(found.select).catch(() =>
        toast($t("explorer.errors.missing"), "error"),
      )
    }

    explorer.go(found.path)
  }
</script>

<div
  bind:clientWidth={barWidth}
  class={[
    "relative flex h-8 min-w-0 grow items-center rounded-field border",
    "border-base-content/10 bg-base-content/5 text-sm",
  ]}
>
  {#if editing}
    <input
      bind:this={field}
      bind:value={draft}
      aria-label={$t("explorer.nav.address")}
      spellcheck="false"
      class="h-full min-w-0 grow bg-transparent px-3 outline-none select-text"
      onblur={() => (editing = false)}
      onkeydown={e => {
        if (e.key === "Enter") {
          e.preventDefault()
          submit()
        }

        if (e.key === "Escape") {
          editing = false
        }
      }}
    />
  {:else}
    <div
      aria-hidden="true"
      class="invisible absolute flex items-center whitespace-nowrap pl-1"
      {@attach measure}
    >
      {#each crumbs as crumb, index (crumb.path)}
        <span class="flex shrink-0 items-center">
          {#if index > 0}
            <Icon icon="lucide:chevron-right" class="size-3.5" />
          {/if}

          <span
            class={[
              "truncate px-2 py-1",
              index === crumbs.length - 1 && "max-w-80",
            ]}
          >
            {crumb.name}
          </span>
        </span>
      {/each}
    </div>

    <nav
      aria-label={$t("explorer.nav.address")}
      class="flex min-w-0 items-center overflow-hidden pl-1"
    >
      {#if hidden > 0}
        <button
          type="button"
          class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-field hover:bg-base-content/10"
          aria-label={$t("explorer.nav.hiddenPath")}
          onclick={showHidden}
        >
          <Icon icon="lucide:chevrons-left" class="size-4" />
        </button>
      {/if}

      {#each crumbs.slice(hidden) as crumb, index (crumb.path)}
        {#if index > 0 || hidden > 0}
          <Icon
            icon="lucide:chevron-right"
            class="size-3.5 shrink-0 text-base-content/40"
          />
        {/if}

        <button
          type="button"
          class={[
            "cursor-pointer truncate rounded-field px-2 py-1",
            "hover:bg-base-content/10",
            index === crumbs.length - hidden - 1
              ? "max-w-80 min-w-0 shrink"
              : "shrink-0",
          ]}
          onclick={() => explorer.go(crumb.path)}
          {@attach prefetchOnHover(crumb.path)}
        >
          {crumb.name}
        </button>
      {/each}
    </nav>

    <button
      type="button"
      class="h-full min-w-8 grow cursor-text"
      aria-label={$t("explorer.nav.address")}
      onclick={edit}
    ></button>
  {/if}
</div>
