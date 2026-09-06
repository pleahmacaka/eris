<script lang="ts">
  import Icon from "@iconify/svelte"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { claudeIcon } from "$lib/claude-icon"
  import * as native from "$lib/native"

  type Message = {
    id: string
    role: "user" | "assistant"
    text: string
  }

  const BUBBLE = 56
  const PANEL_WIDTH = 380
  const PANEL_HEIGHT = 520
  const GAP = 12
  const EDGE = 16
  const TARGET = 64
  const TARGET_BOTTOM = 56
  const CATCH = 90
  const SLOP = 5

  const appWindow = getCurrentWindow()

  let viewport = $state({ width: 0, height: 0 })
  let left = $state(0)
  let top = $state(0)
  let moved = $state(false)
  let dragging = $state(false)
  let open = $state(false)
  let grabX = 0
  let grabY = 0
  let travel = 0

  let messages = $state<Message[]>([])
  let draft = $state("")
  let input = $state<HTMLTextAreaElement>()
  let thread = $state<HTMLElement>()

  const targetX = $derived(viewport.width / 2)
  const targetY = $derived(viewport.height - TARGET_BOTTOM - TARGET / 2)

  const overTarget = $derived(
    dragging &&
      Math.hypot(left + BUBBLE / 2 - targetX, top + BUBBLE / 2 - targetY) <
        CATCH,
  )

  const rightSide = $derived(
    left + BUBBLE + GAP + PANEL_WIDTH + EDGE <= viewport.width,
  )

  const panelLeft = $derived(
    rightSide ? left + BUBBLE + GAP : left - GAP - PANEL_WIDTH,
  )

  const panelTop = $derived(
    Math.min(
      Math.max(EDGE, top + BUBBLE / 2 - PANEL_HEIGHT / 2),
      Math.max(EDGE, viewport.height - PANEL_HEIGHT - EDGE),
    ),
  )

  const rest = () => {
    left = Math.max(EDGE, viewport.width - BUBBLE - EDGE)
    top = Math.round(viewport.height / 2 - BUBBLE / 2)
  }

  const clamp = () => {
    left = Math.min(Math.max(EDGE, left), viewport.width - BUBBLE - EDGE)
    top = Math.min(Math.max(EDGE, top), viewport.height - BUBBLE - EDGE)
  }

  $effect(() => {
    document.documentElement.dataset.surface = "overlay"

    const stops = [
      // the bubble is what the window shows; the panel only opens on the shortcut or a tap
      native.onWindowShown("chat", () => {
        moved = false
        rest()
      }),
      native.onChatToggle(() => toggle()),
    ]

    return () => {
      for (const stop of stops) {
        stop.then(off => off()).catch(() => undefined)
      }
    }
  })

  // the window only takes the monitor size once it is shown, so ride the viewport until the user drags
  $effect(() => {
    if (viewport.width > 0 && viewport.height > 0 && !moved) {
      rest()
    }
  })

  $effect(() => {
    if (messages.length > 0 && thread) {
      thread.scrollTop = thread.scrollHeight
    }
  })

  // only the bubble, the panel and the drop target belong to this window; the rest is the desktop
  $effect(() => {
    const box = (
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    ) => [x, y, x + width, y + height, radius]

    const rects = [box(left, top, BUBBLE, BUBBLE, BUBBLE / 2)]

    if (open && !dragging) {
      rects.push(box(panelLeft, panelTop, PANEL_WIDTH, PANEL_HEIGHT, 28))
    }

    if (dragging) {
      rects.push(
        box(
          targetX - TARGET / 2,
          targetY - TARGET / 2,
          TARGET,
          TARGET,
          TARGET / 2,
        ),
      )
    }

    native.setWindowRegion("chat", rects).catch(() => undefined)
  })

  const hide = () => {
    open = false
    moved = false
    rest()
    native.hideWindow("chat").catch(() => undefined)
  }

  const toggle = () => {
    open = !open

    if (open) {
      appWindow.setFocus().catch(() => undefined)
      queueMicrotask(() => input?.focus())
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      open = false
    }
  }

  const grab = (e: PointerEvent) => {
    if (e.button !== 0) {
      return
    }

    dragging = true
    travel = 0
    grabX = e.clientX - left
    grabY = e.clientY - top
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const move = (e: PointerEvent) => {
    if (!dragging) {
      return
    }

    const nextLeft = e.clientX - grabX
    const nextTop = e.clientY - grabY

    travel += Math.abs(nextLeft - left) + Math.abs(nextTop - top)
    left = nextLeft
    top = nextTop
  }

  const release = (e: PointerEvent) => {
    if (!dragging) {
      return
    }

    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)

    const dropped = overTarget
    const tapped = travel < SLOP

    dragging = false

    if (dropped) {
      hide()

      return
    }

    if (tapped) {
      toggle()

      return
    }

    moved = true
    clamp()
  }

  const send = () => {
    const text = draft.trim()

    if (!text) {
      return
    }

    messages = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", text },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "모델 연결이 아직 설정되지 않았습니다. 설정에서 연동한 뒤 다시 시도하세요.",
      },
    ]

    draft = ""
  }

  const compose = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }
</script>

<svelte:window
  {onkeydown}
  bind:innerWidth={viewport.width}
  bind:innerHeight={viewport.height}
/>

{#if open && !dragging}
  <section
    class="absolute flex flex-col overflow-hidden rounded-[1.75rem] border border-base-content/10 bg-base-100/65 shadow-2xl backdrop-blur-3xl"
    style:left="{panelLeft}px"
    style:top="{panelTop}px"
    style:width="{PANEL_WIDTH}px"
    style:height="{PANEL_HEIGHT}px"
    aria-label="Chat"
  >
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/15 to-transparent"
      aria-hidden="true"
    ></div>

    <header class="flex shrink-0 items-center gap-2 px-5 pt-4 pb-2">
      <span class="grow text-sm font-medium tracking-tight">Claude</span>

      <button
        type="button"
        class="btn btn-circle btn-ghost btn-xs"
        aria-label="Close chat"
        onclick={() => (open = false)}
      >
        <Icon icon="lucide:x" class="size-4" />
      </button>
    </header>

    <div
      bind:this={thread}
      class="flex min-h-0 grow flex-col gap-2 overflow-y-auto px-4 py-2"
    >
      {#each messages as message (message.id)}
        <div
          class={[
            "max-w-[82%] px-4 py-2.5 text-sm leading-relaxed",
            message.role === "user"
              ? "self-end rounded-[1.25rem] rounded-br-md bg-primary text-primary-content"
              : "self-start rounded-[1.25rem] rounded-bl-md bg-base-content/10",
          ]}
        >
          {message.text}
        </div>
      {:else}
        <div class="m-auto flex flex-col items-center gap-3 text-center">
          <Icon icon={claudeIcon} class="size-8 text-primary/70" />

          <p class="text-sm text-base-content/50">무엇이든 물어보세요</p>
        </div>
      {/each}
    </div>

    <div class="shrink-0 p-3">
      <div
        class="flex items-end gap-2 rounded-[1.5rem] border border-base-content/10 bg-base-100/70 py-1.5 pr-1.5 pl-4"
      >
        <textarea
          bind:this={input}
          bind:value={draft}
          onkeydown={compose}
          rows="1"
          placeholder="메시지 입력"
          class="max-h-28 min-h-8 grow resize-none bg-transparent py-1 text-sm outline-none placeholder:text-base-content/35"
        ></textarea>

        <button
          type="button"
          class="btn btn-circle btn-primary btn-sm"
          aria-label="Send"
          disabled={!draft.trim()}
          onclick={send}
        >
          <Icon icon="lucide:arrow-up" class="size-4" />
        </button>
      </div>
    </div>
  </section>
{/if}

<button
  type="button"
  class={[
    "absolute flex cursor-grab items-center justify-center rounded-full border border-base-content/15 bg-base-100/80 shadow-xl backdrop-blur-2xl transition-transform duration-150 active:cursor-grabbing",
    dragging ? "scale-105" : "hover:scale-105",
    open && "ring-2 ring-primary/40",
  ]}
  style:left="{left}px"
  style:top="{top}px"
  style:width="{BUBBLE}px"
  style:height="{BUBBLE}px"
  aria-label="Chat bubble"
  aria-expanded={open}
  onpointerdown={grab}
  onpointermove={move}
  onpointerup={release}
  onpointercancel={release}
>
  <Icon icon={claudeIcon} class="size-6 text-primary" />
</button>

{#if dragging}
  <div
    class={[
      "absolute flex items-center justify-center rounded-full border backdrop-blur-xl transition-[transform,background-color] duration-150",
      overTarget
        ? "scale-125 border-error/40 bg-error/80 text-error-content"
        : "border-base-content/10 bg-base-100/70 text-base-content/70",
    ]}
    style:left="{targetX - TARGET / 2}px"
    style:top="{targetY - TARGET / 2}px"
    style:width="{TARGET}px"
    style:height="{TARGET}px"
    aria-hidden="true"
  >
    <Icon icon="lucide:x" class="size-7" />
  </div>
{/if}
