<script lang="ts">
  import { ContextMenu, type MenuItem } from "@eris/ui"
  import { emit, emitTo } from "@tauri-apps/api/event"
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
  import { tick } from "svelte"
  import { imageIcon } from "../../image-icon"
  import { call } from "../../native"
  import type { PopupPick, PopupRequest } from "../../store/menu-popup.svelte"

  const MARGIN = 12

  document.documentElement.dataset.surface = "popup"

  const current = getCurrentWebviewWindow()

  let request = $state<PopupRequest | null>(null)
  let open = $state(false)

  const pick = (index: number) => {
    if (request) {
      const payload: PopupPick = { seq: request.seq, index }

      emitTo(request.owner, "files-menu:pick", payload).catch(() => undefined)
    }
  }

  const items = $derived(
    (request?.entries ?? []).map((entry, index): MenuItem =>
      entry === "separator"
        ? entry
        : {
            label: entry.label,
            icon: entry.image ? imageIcon(entry.image) : (entry.icon ?? undefined),
            hint: entry.hint ?? undefined,
            disabled: entry.disabled,
            action: () => pick(index),
          },
    ),
  )

  const hide = () => {
    open = false
    call<void>("menu_hide").catch(() => undefined)
  }

  const closed = () => {
    if (request) {
      emitTo(request.owner, "files-menu:closed", request.seq).catch(
        () => undefined,
      )
    }

    hide()
  }

  const place = async () => {
    await tick()

    const box = document.querySelector("[role=menu]")?.getBoundingClientRect()

    if (!request || !box) {
      return
    }

    await call("menu_place", {
      placement: {
        owner: request.owner,
        x: request.x,
        y: request.y,
        width: box.width + MARGIN * 2,
        height: box.height + MARGIN * 2,
        margin: MARGIN,
      },
    }).catch(() => hide())
  }

  $effect(() => {
    const stops = [
      current.listen<PopupRequest>("files-menu:open", e => {
        request = e.payload
        open = true
        place()
      }),
      current.listen<string>("files-menu:key", e => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: e.payload }))
      }),
      current.listen<number>("files-menu:hide", e => {
        if (request?.seq === e.payload) {
          hide()
        }
      }),
    ]

    Promise.all(stops).then(() => {
      call<void>("menu_ready").catch(() => undefined)
      emit("files-menu:ready").catch(() => undefined)
    })

    return () => {
      for (const stop of stops) {
        stop.then(unlisten => unlisten())
      }
    }
  })
</script>

<svelte:document oncontextmenu={e => e.preventDefault()} />

{#if request}
  <ContextMenu
    bind:open
    {items}
    x={MARGIN}
    y={MARGIN}
    pinned
    dense={request.dense}
    onclose={closed}
  />
{/if}

<style>
  :global(:root[data-surface="popup"]),
  :global(:root[data-surface="popup"] body),
  :global(:root[data-surface="popup"] .siri-shell) {
    background: transparent !important;
  }

  :global(:root[data-surface="popup"] .siri-shell) {
    opacity: 1;
  }

  :global(:root[data-surface="popup"] .siri-aura) {
    display: none;
  }

  :global(:root[data-surface="popup"] [role="menu"].eris-card) {
    background-color: var(--color-base-100);
    backdrop-filter: none;
  }
</style>
