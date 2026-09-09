import { listen } from "@tauri-apps/api/event"
import * as native from "$lib/native"

const HOVER_DELAY = 400
const LEAVE_GRACE = 260

let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined
let overPreview = false
let listening = false

const stopTimers = () => {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
}

const watchPreview = () => {
  if (listening) {
    return
  }

  listening = true

  listen<boolean>("preview-hover", e => {
    overPreview = e.payload

    if (overPreview) {
      clearTimeout(closeTimer)

      return
    }

    closePreview()
  }).catch(() => {
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
    if (overPreview) {
      return
    }

    native.previewHide().catch(() => undefined)
  }, LEAVE_GRACE)
}

export const dismissPreview = () => {
  stopTimers()
  overPreview = false
  native.previewHide().catch(() => undefined)
}
