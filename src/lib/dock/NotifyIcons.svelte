<script lang="ts">
  import { flip } from "svelte/animate"
  import { notifyIconClick, notifyIcons, onTrayIcons, type TrayIcon } from "$lib/native"

  type Props = {
    compact?: boolean
    order?: string[]
    onreorder?: (order: string[]) => void
  }

  let { compact = false, order = [], onreorder }: Props = $props()

  const SWEEP = 15_000

  let icons = $state<TrayIcon[]>([])

  const refresh = async () => {
    icons = await notifyIcons().catch(() => icons)
  }

  $effect(() => {
    refresh()

    const timer = setInterval(refresh, SWEEP)
    const stop = onTrayIcons(refresh)

    return () => {
      clearInterval(timer)
      stop.then(off => off()).catch(() => undefined)
    }
  })

  const click = (id: string, button: "left" | "right") => {
    notifyIconClick(id, button).catch(() => undefined)
  }

  const sorted = $derived.by(() => {
    const rank = new Map(order.map((id, index) => [id, index]))

    return [...icons].sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  })

  let dragId = $state<string | null>(null)
  let dropId = $state<string | null>(null)
  let dropBefore = $state(true)

  const dragOver = (e: DragEvent, id: string) => {
    e.preventDefault()

    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()

    dropId = id
    dropBefore = e.clientX < box.left + box.width / 2
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()

    const from = dragId
    const onto = dropId
    const before = dropBefore

    dragId = null
    dropId = null

    if (!from || !onto || from === onto) {
      return
    }

    const ids = sorted.map(icon => icon.id).filter(id => id !== from)
    const at = ids.indexOf(onto)

    if (at < 0) {
      return
    }

    ids.splice(before ? at : at + 1, 0, from)
    onreorder?.(ids)
  }
</script>

{#if icons.length > 0}
  <div class="flex items-center gap-px" role="list">
    {#each sorted as icon (icon.id)}
      <div
        animate:flip={{ duration: 180 }}
        role="listitem"
        class={[
          "relative flex transition-opacity duration-150",
          dragId === icon.id && "opacity-30",
        ]}
        ondragover={e => dragOver(e, icon.id)}
        ondrop={drop}
        ondragend={() => {
          dragId = null
          dropId = null
        }}
      >
        {#if dropId === icon.id && dropBefore}
          <span
            class="pointer-events-none absolute inset-y-1 -left-0.5 w-0.5 rounded-full bg-primary"
          ></span>
        {/if}

        {#if dropId === icon.id && !dropBefore}
          <span
            class="pointer-events-none absolute inset-y-1 -right-0.5 w-0.5 rounded-full bg-primary"
          ></span>
        {/if}

        <button
          class={["btn btn-ghost btn-square", compact ? "btn-xs" : "btn-sm"]}
          title={icon.tooltip}
          aria-label={icon.tooltip || "Tray icon"}
          draggable="true"
          ondragstart={e => {
            e.dataTransfer?.setData("text/plain", icon.id)
            dragId = icon.id
          }}
          onclick={() => click(icon.id, "left")}
          oncontextmenu={e => {
            e.preventDefault()
            click(icon.id, "right")
          }}
        >
          {#if icon.icon}
            <img src={icon.icon} alt="" class="size-4" draggable="false" />
          {:else}
            <span class="size-2 rounded-full bg-base-content/40"></span>
          {/if}
        </button>
      </div>
    {/each}
  </div>
{/if}
