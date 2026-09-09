import type { Bubbles } from "./bubbles.svelte"

export const frameRects = (chat: Bubbles, cover: boolean) => {
  const { area, sizes } = chat
  const rects: number[][] = []

  if (cover) {
    rects.push([0, 0, area.width, area.height, 0])

    return rects
  }

  for (const b of chat.bubbles) {
    const p = chat.at(b)

    rects.push([
      p.left,
      p.top,
      p.left + sizes.bubble,
      p.top + sizes.bubble,
      sizes.bubble / 2,
    ])
  }

  const hovered = chat.hovered

  if (hovered && hovered.id !== chat.openId) {
    const p = chat.at(hovered)

    if (chat.device.chatMultiBubble) {
      rects.push([
        p.left,
        p.top - sizes.plus / 2,
        p.left + sizes.bubble,
        p.top + sizes.bubble + sizes.plus / 2,
        sizes.bubble / 2,
      ])
    }

    if (chat.tipWidth > 0 && chat.tipOf(hovered)) {
      const right = chat.cornerOf(hovered).right
      const x = right
        ? p.left - sizes.tipGap - chat.tipWidth
        : p.left + sizes.bubble + sizes.tipGap
      const y = p.top + sizes.bubble / 2 - chat.tipHeight / 2

      rects.push([x, y, x + chat.tipWidth, y + chat.tipHeight, chat.px(0.5)])
    }
  }

  if (chat.open && !chat.dragging) {
    rects.push([
      chat.panelLeft,
      chat.panelTop,
      chat.panelLeft + sizes.panelWidth,
      chat.panelTop + sizes.panelHeight,
      chat.panelRadius,
    ])
  }

  if (chat.dragging) {
    rects.push([
      chat.targetX - sizes.target / 2,
      chat.targetY - sizes.target / 2,
      chat.targetX + sizes.target / 2,
      chat.targetY + sizes.target / 2,
      sizes.target / 2,
    ])
  }

  if (chat.slide) {
    rects.push(chat.slide)
  }

  return rects
}
