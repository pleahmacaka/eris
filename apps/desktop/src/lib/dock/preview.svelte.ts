import { listen } from "@tauri-apps/api/event"
import * as native from "$lib/native"

const HOVER_DELAY = 400
const LEAVE_GRACE = 260

let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined
let listening = false

export const previewHover = $state({ over: false })

const stopTimers = () => {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
}

const watchPreview = () => {
  if (listening) {
    return
  }

  listening = true

  Promise.all([
    listen<boolean>("preview-hover", e => {
      previewHover.over = e.payload

      if (previewHover.over) {
        clearTimeout(closeTimer)

        return
      }

      closePreview()
    }),
    listen("preview-hidden", () => {
      previewHover.over = false
    }),
  ]).catch(() => {
    listening = false
  })
}

export const openPreview = (windows: number[], center: number) => {
  watchPreview()
  stopTimers()

  if (windows.length === 0) {
    return
  }

  openTimer = setTimeout(() => {
    native.previewShow(windows, center).catch(() => undefined)
  }, HOVER_DELAY)
}

export const closePreview = () => {
  stopTimers()

  closeTimer = setTimeout(() => {
    if (previewHover.over) {
      return
    }

    native.previewHide().catch(() => undefined)
  }, LEAVE_GRACE)
}

export const dismissPreview = () => {
  stopTimers()
  previewHover.over = false
  native.previewHide().catch(() => undefined)
}
