<script lang="ts">
  import { onDevice } from "@eris/settings"
  import { listen } from "@tauri-apps/api/event"
  import { untrack } from "svelte"
  import { BubbleLayer, Chat, ChatPanel, frameRects, loadArea } from "$lib/claude"
  import { ensureDevice } from "$lib/device"
  import { editing, watchEdit } from "$lib/edit"
  import * as native from "$lib/native"

  const chat = new Chat()

  let previewing = $state<number | null>(null)

  $effect(() => {
    document.documentElement.dataset.surface = "overlay"
    loadArea(chat)
    native.claudeWhich().then(path => {
      chat.cli = path
    })

    ensureDevice().then(d => {
      chat.device = d
    })

    const stopEditWatch = watchEdit()

    const stops = [
      native.onWindowShown("chat", () => loadArea(chat)),
      native.onChatToggle(() => chat.toggle()),
      onDevice(d => {
        chat.device = d
      }),
      listen<{ percent: number; on: boolean }>("chat-snap-preview", e => {
        previewing = e.payload.on ? e.payload.percent : null
      }),
    ]

    return () => {
      stopEditWatch()

      for (const stop of stops) {
        stop.then(off => off()).catch(() => undefined)
      }

      for (const b of chat.bubbles) {
        b.session?.stop()
      }
    }
  })

  $effect(() => {
    for (const b of chat.bubbles) {
      const results = b.session?.results ?? 0
      const seen = untrack(() => b.seen)

      if (results !== seen) {
        b.seen = results

        if (results > seen && chat.openId !== b.id) {
          b.unread = true
        }
      }
    }
  })

  $effect(() => {
    if (chat.area.width === 0) {
      return
    }

    native
      .chatFrame(
        [0, 0, chat.area.width, chat.area.height],
        frameRects(chat, previewing !== null || editing.on),
      )
      .catch(() => undefined)
  })
</script>

<svelte:window
  onkeydown={e => {
    if (e.key === "Escape" && chat.open) {
      chat.escape()
    }
  }}
/>

<div class="absolute top-0 left-0">
  {#if previewing !== null}
    {#each chat.area.monitors as m, index (index)}
      {@const bandX = (m.width * previewing) / 100}
      {@const bandY = (m.height * previewing) / 100}

      {#each [[m.x, m.y, m.width, bandY], [m.x, m.y + m.height - bandY, m.width, bandY], [m.x, m.y, bandX, m.height], [m.x + m.width - bandX, m.y, bandX, m.height]] as [x, y, w, h], side (side)}
        <div
          class="pointer-events-none absolute border border-primary/40 bg-primary/15"
          style:left="{x}px"
          style:top="{y}px"
          style:width="{w}px"
          style:height="{h}px"
          aria-hidden="true"
        ></div>
      {/each}

      <div
        class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-box bg-base-100 px-4 py-2 text-lg font-medium tabular-nums shadow-xl"
        style:left="{m.x + m.width / 2}px"
        style:top="{m.y + m.height / 2}px"
        aria-hidden="true"
      >
        {previewing}%
      </div>
    {/each}
  {/if}

  <ChatPanel {chat} />

  <BubbleLayer {chat} />
</div>
