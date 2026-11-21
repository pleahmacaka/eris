<script lang="ts">
import Icon from "@iconify/svelte"
import type { Attachment } from "svelte/attachments"
import { scale } from "svelte/transition"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import {
  isTextField,
  replaceSelection,
  selectedText,
  type TextField,
} from "#lib/menu/field.js"
import { type MenuItem, menuRows, navigate } from "#lib/menu/items.js"
import { fieldMenu, selectionMenu } from "#lib/menu/menus.js"
import { placeMenu } from "#lib/menu/position.js"
import { duration, QUICK_MS } from "#lib/motion/durations.js"
import {
  contextMenuStore,
  type OpenMenu,
} from "#lib/store/contextMenu.svelte.js"
import { beforeNavigate } from "$app/navigation"

let { boundary }: { boundary?: HTMLElement } = $props()

const EDGE_REM = 0.5

let panel = $state<HTMLDivElement>()
let active = $state(-1)
let scrollArmed = false

const menu = $derived(contextMenuStore.open)
const rows = $derived(menu ? menuRows(menu.sections) : [])
const items = $derived(
  rows.flatMap(row => (row.kind === "item" ? [row.item] : [])),
)

const itemId = (index: number) => `context-menu-item-${index}`

const isMac = () => navigator.userAgent.includes("Mac")

const copy = (text: string) => {
  void navigator.clipboard.writeText(text)
}

const fieldSections = (field: TextField) =>
  fieldMenu(
    {
      selected: selectedText(field) !== "",
      filled: field.value !== "",
      secret: field.type === "password",
    },
    {
      cut: () => {
        copy(selectedText(field))
        replaceSelection(field, "")
      },
      copy: () => copy(selectedText(field)),
      paste: () => {
        void navigator.clipboard
          .readText()
          .then(text => replaceSelection(field, text))
      },
      selectAll: () => field.select(),
    },
    isMac(),
  )

const inPanel = (target: EventTarget | null) =>
  target instanceof Node && panel?.contains(target) === true

const onContextMenu = (event: MouseEvent) => {
  event.preventDefault()

  const target = event.target

  if (!(target instanceof Element) || inPanel(target)) {
    return
  }

  const selection = getSelection()?.toString() ?? ""
  const sections =
    isTextField(target) && !target.readOnly && !target.disabled
      ? fieldSections(target)
      : [
          ...selectionMenu(selection, () => copy(selection), isMac()),
          ...contextMenuStore.offered(event),
        ]

  contextMenuStore.show(
    sections,
    { x: event.clientX, y: event.clientY },
    target,
  )
}

const dismiss = (event: Event) => {
  if (menu && !inPanel(event.target)) {
    contextMenuStore.close()
  }
}

const onScroll = (event: Event) => {
  const scrolled = event.target
  const source = menu?.source
  const moved =
    !(scrolled instanceof Element) || !source || scrolled.contains(source)

  if (scrollArmed && moved) {
    dismiss(event)
  }
}

const activate = (item: MenuItem) => {
  if (!item.disabled) {
    contextMenuStore.close(true)
    item.run()
  }
}

const onKeyDown = (event: KeyboardEvent) => {
  const target = navigate(items, active, event.key)
  const item = items[active]

  if (target !== null) {
    event.preventDefault()
    active = target
    document
      .getElementById(itemId(target))
      ?.scrollIntoView({ block: "nearest" })
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault()

    if (item) {
      activate(item)
    }
  } else if (event.key === "Escape" || event.key === "Tab") {
    event.preventDefault()
    event.stopPropagation()
    contextMenuStore.close(true)
  }
}

const onFocusOut = (event: FocusEvent) => {
  if (!inPanel(event.relatedTarget)) {
    contextMenuStore.close()
  }
}

const place =
  (open: OpenMenu): Attachment<HTMLElement> =>
  node => {
    // a modal dialog makes everything outside it inert, so the menu has to live inside the dialog it opened from
    open.layer?.append(node)

    const rem = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    )
    const margin = EDGE_REM * rem
    const bounds = (
      boundary ?? document.documentElement
    ).getBoundingClientRect()

    node.style.maxHeight = `${(bounds.height - 2 * margin) / rem}rem`

    const spot = placeMenu(
      open.point,
      { width: node.offsetWidth, height: node.offsetHeight },
      bounds,
      margin,
    )

    node.style.left = `${spot.x / rem}rem`
    node.style.top = `${spot.y / rem}rem`
    node.style.transformOrigin = spot.origin
    active = -1
    scrollArmed = false
    node.focus({ preventScroll: true })

    // a scroll that ended just before the right-click still dispatches its event one frame later
    const frame = requestAnimationFrame(() => {
      scrollArmed = true
    })

    return () => {
      cancelAnimationFrame(frame)

      if (open.layer) {
        node.remove()
      }
    }
  }

beforeNavigate(() => contextMenuStore.close())
</script>

<svelte:window
  oncontextmenu={onContextMenu}
  onpointerdown={dismiss}
  onscrollcapture={onScroll}
  onresize={() => contextMenuStore.close()}
  onblur={() => contextMenuStore.close()}
/>

{#if menu}
  {#key menu.id}
    <div
      bind:this={panel}
      {@attach place(menu)}
      role="menu"
      tabindex="-1"
      aria-label={i18n.t("menu.label")}
      aria-activedescendant={active < 0 ? undefined : itemId(active)}
      class={[
        "fixed z-60 flex min-w-48 max-w-80 flex-col overflow-y-auto rounded-field border p-1",
        "border-base-content/10 bg-base-300 text-sm shadow-xl outline-none",
      ]}
      onkeydown={onKeyDown}
      onfocusout={onFocusOut}
      onpointerleave={() => {
        active = -1
      }}
      in:scale|global={{ start: 0.96, duration: duration(QUICK_MS) }}
    >
      {#each rows as row (row.kind === "item" ? row.item.id : row.key)}
        {#if row.kind === "separator"}
          <div class="mx-1 my-1 border-base-content/10 border-t" role="separator"></div>
        {:else}
          <button
            type="button"
            role="menuitem"
            tabindex="-1"
            id={itemId(row.index)}
            aria-disabled={row.item.disabled}
            class={[
              "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-start",
              row.item.disabled
                ? "cursor-default text-base-content/30"
                : [
                    "cursor-pointer",
                    row.item.danger
                      ? active === row.index
                        ? "bg-error text-error-content"
                        : "text-error"
                      : active === row.index
                        ? "bg-primary text-primary-content"
                        : "text-base-content/80",
                  ],
            ]}
            onpointermove={() => {
              active = row.item.disabled ? -1 : row.index
            }}
            onmousedown={event => event.preventDefault()}
            onclick={() => activate(row.item)}
          >
            <span class="min-w-0 flex-1 truncate">{i18n.text(row.item.label)}</span>
            {#if row.item.hint}
              <span class="text-xs tabular-nums opacity-60">{row.item.hint}</span>
            {/if}
            <Icon icon={row.item.icon} class="size-4 shrink-0" />
          </button>
        {/if}
      {/each}
    </div>
  {/key}
{/if}
