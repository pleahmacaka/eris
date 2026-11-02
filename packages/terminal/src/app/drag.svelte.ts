import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { panesOf } from "./layout"
import { type Handoff, paneLabel, session, tearOff } from "./tabs.svelte"
import { hoverTab, registerHost } from "./windows"

export type Card = { title: string; shell: string; panes: number }

type Point = { x: number; y: number; card: Card | null }

export const SLOP = 6

const REMOTE = -1

export const drag = $state({
  tab: null as number | null,
  x: 0,
  y: 0,
  card: null as Card | null,
})

const landings = new Set<(tab: number) => boolean>()

const land = (tab: number) => [...landings].some(handler => handler(tab))

let away = false

let stale = false

let hovering: Promise<unknown> | null = null

const reach = (active: boolean) => {
  if (!active && !away) {
    return
  }

  if (active && hovering) {
    stale = true

    return
  }

  away = active
  stale = false
  hovering = hoverTab(active, drag.card)
    .catch(() => undefined)
    .finally(() => {
      hovering = null

      if (stale && away) {
        reach(true)
      }
    })
}

const settle = () => hovering ?? Promise.resolve()

let settled = true

let spring: ReturnType<typeof setTimeout> | undefined

export const onTabDrop = (handler: (tab: number) => boolean) => {
  landings.add(handler)

  return () => {
    landings.delete(handler)
  }
}

export const justDragged = () => !settled

export const springTo = (target: number, open: () => void) => {
  clearTimeout(spring)

  if (drag.tab !== null && drag.tab !== target) {
    spring = setTimeout(open, 450)
  }
}

export const unspring = () => clearTimeout(spring)

const cardOf = (tabId: number): Card | null => {
  const tab = session.tabs.find(entry => entry.id === tabId)

  if (!tab) {
    return null
  }

  const panes = panesOf(tab.root)
  const focused = panes.find(pane => pane.id === tab.focus) ?? panes[0]

  return {
    title: tab.name || paneLabel(focused),
    shell: focused.shell,
    panes: panes.length,
  }
}

const outside = (u: PointerEvent) =>
  u.clientX < 0 ||
  u.clientY < 0 ||
  u.clientX > window.innerWidth ||
  u.clientY > window.innerHeight

export const pressTab = (e: PointerEvent, tab: number) => {
  if (e.button !== 0) {
    return
  }

  const startX = e.clientX
  const startY = e.clientY
  let lifted = false

  // the area shows the active tab, so dragging that tab needs a neighbor underneath to split
  const lift = () => {
    const index = session.tabs.findIndex(entry => entry.id === tab)

    if (index === session.active && session.tabs.length > 1) {
      lifted = true
      session.active = index < session.tabs.length - 1 ? index + 1 : index - 1
    }
  }

  const putBack = () => {
    if (lifted) {
      const index = session.tabs.findIndex(entry => entry.id === tab)

      if (index >= 0) {
        session.active = index
      }
    }
  }

  const move = (m: PointerEvent) => {
    const far = Math.hypot(m.clientX - startX, m.clientY - startY) >= SLOP

    if (drag.tab === null && !far) {
      return
    }

    if (drag.tab === null) {
      lift()
      drag.card = cardOf(tab)
    }

    drag.tab = tab
    drag.x = m.clientX
    drag.y = m.clientY
    reach(outside(m))
  }

  const finish = (drop: boolean, u?: PointerEvent) => {
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
    window.removeEventListener("keydown", cancel, true)
    unspring()

    if (drag.tab === null) {
      return
    }

    if (drop && u && outside(u)) {
      away = false
      settle()
        .then(() => tearOff(tab))
        .catch(() => undefined)
    } else {
      reach(false)

      if (!drop || !land(tab)) {
        putBack()
      }
    }

    drag.tab = null
    drag.card = null
    settled = false
    setTimeout(() => {
      settled = true
    })
  }

  const up = (u: PointerEvent) => finish(true, u)

  const cancel = (k: KeyboardEvent) => {
    if (k.key === "Escape") {
      k.stopPropagation()
      finish(false)
    }
  }

  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", up)
  window.addEventListener("keydown", cancel, true)
}

const hover = (at: Point | null) => {
  if (at) {
    drag.tab = REMOTE
    drag.x = at.x
    drag.y = at.y
    drag.card = at.card ?? drag.card
  } else if (drag.tab === REMOTE) {
    drag.tab = null
    drag.card = null
  }
}

// landing handlers move local tabs, so the incoming tab is adopted before it lands
const receive = (handoff: Handoff, adopt: (handoff: Handoff) => void) => {
  const before = session.active
  const pointed = drag.tab === REMOTE

  adopt(handoff)

  const index = session.tabs.length - 1

  if (pointed && before < index) {
    session.active = before

    if (!land(session.tabs[index].id)) {
      session.active = index
    }
  }

  hover(null)
}

export const acceptTabs = (adopt: (handoff: Handoff) => void) => {
  const view = getCurrentWebviewWindow()
  const stops = [
    view.listen<Point | null>("eris-terminal:hover", e => hover(e.payload)),
    view.listen<Handoff>("eris-terminal:adopt", e => receive(e.payload, adopt)),
  ]

  registerHost().catch(() => undefined)

  return () => {
    for (const stop of stops) {
      stop.then(unlisten => unlisten())
    }
  }
}
