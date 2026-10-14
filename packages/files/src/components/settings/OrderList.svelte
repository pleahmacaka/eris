<script lang="ts" generics="T extends string">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import type { Arrangement } from "../../store/prefs.svelte"

  let {
    arrangement = $bindable(),
    labelOf,
    iconOf,
    hintOf,
    locked,
    label,
  }: {
    arrangement: Arrangement<T>
    labelOf: (id: T) => string
    iconOf: (id: T) => string
    hintOf?: (id: T) => string
    locked?: (id: T) => boolean
    label: string
  } = $props()

  const uid = $props.id()

  const THRESHOLD = 4

  let list = $state<HTMLElement>()
  let dragging = $state<T | null>(null)
  let pressed: { id: T; y: number } | null = null

  const move = (id: T, to: number) => {
    const order = arrangement.order.filter(entry => entry !== id)
    const at = Math.min(Math.max(to, 0), order.length)

    order.splice(at, 0, id)

    if (order.some((entry, index) => entry !== arrangement.order[index])) {
      arrangement.order = order
    }
  }

  const toggle = (id: T, shown: boolean) => {
    arrangement.hidden = shown
      ? arrangement.hidden.filter(entry => entry !== id)
      : [...arrangement.hidden, id]
  }

  const indexAt = (id: T, y: number) =>
    [...(list?.children ?? [])].filter(row => {
      const box = row.getBoundingClientRect()

      return row.id !== `${uid}-row-${id}` && box.top + box.height / 2 < y
    }).length

  const onpointerdown = (e: PointerEvent, id: T) => {
    if (e.button !== 0 || (e.target as Element).closest("input")) {
      return
    }

    pressed = { id, y: e.clientY }
    list?.setPointerCapture(e.pointerId)
  }

  const onpointermove = (e: PointerEvent) => {
    if (!pressed) {
      return
    }

    if (!dragging && Math.abs(e.clientY - pressed.y) < THRESHOLD) {
      return
    }

    dragging = pressed.id
    move(dragging, indexAt(dragging, e.clientY))
  }

  const release = () => {
    pressed = null
    dragging = null
  }

  const onkeydown = (e: KeyboardEvent, id: T, index: number) => {
    const step = { ArrowUp: -1, ArrowDown: 1 }[e.key]

    if (step && e.altKey) {
      e.preventDefault()
      move(id, index + step)
      requestAnimationFrame(() =>
        document.getElementById(`${uid}-${id}`)?.focus(),
      )
    }
  }
</script>

<ul
  bind:this={list}
  aria-label={label}
  class="flex flex-col rounded-box border border-base-content/10 p-1"
  {onpointermove}
  onpointerup={release}
  onpointercancel={release}
  onlostpointercapture={release}
>
  {#each arrangement.order as id, index (id)}
    {@const shown = !arrangement.hidden.includes(id)}
    {@const fixed = locked?.(id) ?? false}

    <li
      id="{uid}-row-{id}"
      class={[
        "flex touch-none items-center gap-2 rounded-field px-2 py-1.5 select-none",
        "transition-colors duration-120 hover:bg-base-content/6",
        "has-focus-visible:bg-base-content/8",
        dragging === id
          ? "cursor-grabbing bg-base-content/10"
          : "cursor-grab",
      ]}
      onpointerdown={e => onpointerdown(e, id)}
    >
      <button
        type="button"
        id="{uid}-{id}"
        class="flex shrink-0 cursor-grab text-base-content/35 outline-none"
        aria-label={labelOf(id)}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        onkeydown={e => onkeydown(e, id, index)}
      >
        <Icon icon="lucide:grip-vertical" class="size-4" />
      </button>

      <Icon
        icon={iconOf(id)}
        class={["size-4 shrink-0", !shown && "text-base-content/35"]}
      />

      <span
        class={[
          "flex min-w-0 grow flex-col",
          !shown && "text-base-content/45",
        ]}
      >
        <span class="truncate">{labelOf(id)}</span>

        {#if hintOf}
          <span class="truncate text-xs text-base-content/50">{hintOf(id)}</span>
        {/if}
      </span>

      <input
        type="checkbox"
        class="toggle toggle-sm toggle-primary"
        aria-label={$t("explorer.settings.order.show", {
          values: { name: labelOf(id) },
        })}
        checked={shown}
        disabled={fixed}
        onchange={e => toggle(id, e.currentTarget.checked)}
      />
    </li>
  {/each}
</ul>
