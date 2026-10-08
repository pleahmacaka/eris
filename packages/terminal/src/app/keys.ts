import { isSplit, neighbor } from "./layout"
import { closePane, cycleTab, openTab, session, splitPane } from "./tabs.svelte"

const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const

const paneShortcut = (e: KeyboardEvent) => {
  const tab = session.tabs[session.active]
  const alt = e.altKey && !e.ctrlKey && !e.metaKey

  if (!tab || !alt) {
    return false
  }

  if (e.shiftKey && (e.code === "Equal" || e.code === "Minus")) {
    splitPane(tab, e.code === "Equal" ? "right" : "bottom")

    return true
  }

  const arrow = ARROWS.find(key => key === e.key)

  if (e.shiftKey || !arrow || !isSplit(tab.root)) {
    return false
  }

  const next = neighbor(tab.root, tab.focus, arrow)

  if (next) {
    tab.focus = next.id
  }

  return !!next
}

export const sessionShortcut = (e: KeyboardEvent) => {
  if (paneShortcut(e)) {
    return true
  }

  const ctrl = e.ctrlKey && !e.altKey && !e.metaKey

  if (ctrl && e.code === "Tab") {
    cycleTab(e.shiftKey ? -1 : 1)

    return true
  }

  if (!ctrl || !e.shiftKey) {
    return false
  }

  const tab = session.tabs[session.active]

  if (e.code === "KeyT") {
    openTab()
  } else if (e.code === "KeyW" && tab) {
    closePane(tab.focus)
  } else if (e.code === "KeyB" && tab) {
    tab.sync = !tab.sync
  } else {
    return false
  }

  return true
}
