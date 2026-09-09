import * as native from "$lib/native"
import type { Bubble, Bubbles } from "./bubbles.svelte"
import type { Chat } from "./chat.svelte"
import { type Point, settleAt } from "./geometry"

const HUES = [25, 75, 145, 200, 255, 300, 340]
const SLIDE = 260

const nextHue = (chat: Bubbles) =>
  HUES.find(h => !chat.bubbles.some(b => b.hue === h)) ??
  HUES[chat.bubbles.length % HUES.length]

const make = (chat: Bubbles, from: Partial<Bubble> = {}): Bubble => ({
  id: crypto.randomUUID(),
  hue: nextHue(chat),
  stack: crypto.randomUUID(),
  left: 0,
  top: 0,
  corner: { right: true, bottom: true },
  folder: "",
  session: null,
  unread: false,
  title: "",
  seen: 0,
  started: "",
  ...from,
})

const place = (chat: Bubbles) => {
  const home = chat.area.monitors[chat.area.home] ?? chat.whole

  chat.bubbles = [
    make(chat, {
      hue: HUES[0],
      left: home.x + home.width - chat.sizes.bubble - chat.sizes.edge,
      top: home.y + home.height - chat.sizes.bubble - chat.sizes.edge,
      folder: chat.stored.folder ?? "",
    }),
  ]
}

const glide = (chat: Bubbles, from: Point, to: Bubble, height: number) => {
  chat.slide = [
    Math.min(from.left, to.left),
    Math.min(from.top, to.top),
    Math.max(from.left, to.left) + chat.sizes.bubble,
    Math.max(from.top, to.top) + height,
    0,
  ]

  clearTimeout(chat.slideTimer)
  chat.slideTimer = setTimeout(() => {
    chat.slide = null
  }, SLIDE)
}

export const settle = (chat: Bubbles, stack: string) => {
  const head = chat.headOf(stack)

  if (!head) {
    return
  }

  const height = chat.heightOf(stack)
  const from = { left: head.left, top: head.top }
  const next = settleAt(from, height, {
    monitors: chat.area.monitors,
    fallback: chat.whole,
    snap: chat.snap,
    bubble: chat.sizes.bubble,
    edge: chat.sizes.edge,
  })

  head.corner = next.corner
  head.left = next.left
  head.top = next.top

  if (head.left !== from.left || head.top !== from.top) {
    glide(chat, from, head, height)
  }
}

const settleAll = (chat: Bubbles) => {
  for (const stack of new Set(chat.bubbles.map(b => b.stack))) {
    settle(chat, stack)
  }
}

export const loadArea = async (chat: Bubbles) => {
  chat.unit = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  )

  const next = await native.chatArea().catch(() => null)

  if (!next) {
    return
  }

  chat.area = next

  if (chat.placed) {
    settleAll(chat)
  } else {
    place(chat)
    chat.placed = true
  }
}

const capture = (e: PointerEvent, on: boolean) => {
  const target = e.currentTarget as HTMLElement

  try {
    if (on) {
      target.setPointerCapture(e.pointerId)
    } else {
      target.releasePointerCapture(e.pointerId)
    }
  } catch {
    return
  }
}

export const spawn = (chat: Chat, from: Bubble, above: boolean) => {
  if (!chat.device.chatMultiBubble) {
    return
  }

  const index = chat.bubbles.findIndex(b => b.id === from.id)
  const isHead = chat.headOf(from.stack)?.id === from.id
  const nb = make(chat, {
    stack: from.stack,
    left: from.left,
    top: above && isHead ? from.top - chat.sizes.step : from.top,
    corner: { ...from.corner },
    folder: from.folder,
  })
  const cut = index + (above ? 0 : 1)

  chat.bubbles = [...chat.bubbles.slice(0, cut), nb, ...chat.bubbles.slice(cut)]
  chat.hoverId = null
  settle(chat, nb.stack)
  chat.openPanel(nb.id)
}

const remove = (chat: Chat, b: Bubble) => {
  if (chat.bubbles.length === 1) {
    chat.hide()

    return
  }

  const members = chat.membersOf(b.stack)
  const next = members[0]?.id === b.id ? members[1] : undefined

  if (next) {
    const p = chat.at(next)

    next.left = p.left
    next.top = p.top
  }

  b.session?.stop()

  if (chat.openId === b.id) {
    chat.closePanel()
  }

  if (chat.lastId === b.id) {
    chat.lastId = null
  }

  chat.bubbles = chat.bubbles.filter(x => x.id !== b.id)
  settleAll(chat)
}

const attach = (chat: Chat, b: Bubble) => {
  const moving = chat.membersOf(b.stack)

  for (const other of chat.bubbles) {
    if (other.stack === b.stack || chat.headOf(other.stack)?.id !== other.id) {
      continue
    }

    const count = chat.membersOf(other.stack).length
    const aboveTop = other.top - moving.length * chat.sizes.step
    const belowTop = other.top + count * chat.sizes.step
    const nearAbove =
      Math.hypot(b.left - other.left, b.top - aboveTop) < chat.sizes.attach
    const nearBelow =
      Math.hypot(b.left - other.left, b.top - belowTop) < chat.sizes.attach

    if (!nearAbove && !nearBelow) {
      continue
    }

    const rest = chat.bubbles.filter(x => x.stack !== b.stack)
    const index = nearAbove
      ? rest.findIndex(x => x.id === other.id)
      : rest.map(x => x.stack).lastIndexOf(other.stack) + 1

    if (nearAbove) {
      b.left = other.left
      b.top = aboveTop
    }

    for (const m of moving) {
      m.stack = other.stack
    }

    chat.bubbles = [...rest.slice(0, index), ...moving, ...rest.slice(index)]
    settle(chat, other.stack)

    return true
  }

  return false
}

export const grab = (chat: Chat, e: PointerEvent, b: Bubble) => {
  if (e.button !== 0) {
    return
  }

  const p = chat.at(b)

  chat.grabX = e.clientX - p.left
  chat.grabY = e.clientY - p.top
  chat.lastX = e.clientX
  chat.lastY = e.clientY
  chat.travel = 0
  chat.moved = false
  chat.dragId = b.id
  chat.hoverId = null
  capture(e, true)
}

export const move = (chat: Chat, e: PointerEvent) => {
  const b = chat.dragged

  if (!b) {
    return
  }

  chat.travel +=
    Math.abs(e.clientX - chat.lastX) + Math.abs(e.clientY - chat.lastY)
  chat.lastX = e.clientX
  chat.lastY = e.clientY

  if (!chat.moved) {
    if (chat.travel < chat.sizes.slop) {
      return
    }

    chat.moved = true

    if (chat.headOf(b.stack)?.id !== b.id) {
      const p = chat.at(b)

      b.left = p.left
      b.top = p.top
      b.stack = crypto.randomUUID()
    }
  }

  b.left = e.clientX - chat.grabX
  b.top = e.clientY - chat.grabY
}

export const release = (chat: Chat, e: PointerEvent) => {
  const b = chat.dragged

  if (!b) {
    return
  }

  capture(e, false)

  const wasMoved = chat.moved
  const dropped = chat.overTarget

  chat.dragId = null
  chat.moved = false

  if (!wasMoved) {
    chat.toggle(b.id)

    return
  }

  if (dropped) {
    remove(chat, b)

    return
  }

  if (chat.device.chatMultiBubble && attach(chat, b)) {
    return
  }

  settle(chat, b.stack)
}
