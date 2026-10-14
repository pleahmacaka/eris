import {
  type ContextMenuRequest,
  closeContextMenu,
  contextMenu,
  isAction,
  type MenuItem,
  type MenuPresenter,
} from "@eris/ui"
import { emitTo, listen } from "@tauri-apps/api/event"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { imageOf } from "../image-icon"
import { call } from "../native"

export const POPUP = "files-menu"

export type PopupEntry =
  | {
      label: string
      icon: string | null
      image: string | null
      hint: string | null
      disabled: boolean
    }
  | "separator"

export type PopupRequest = {
  seq: number
  owner: string
  x: number
  y: number
  dense: boolean
  entries: PopupEntry[]
}

export type PopupPick = { seq: number; index: number }

const serialize = (item: MenuItem): PopupEntry =>
  isAction(item)
    ? {
        label: item.label,
        icon: item.icon ?? null,
        image: item.icon ? imageOf(item.icon) : null,
        hint: item.hint ?? null,
        disabled: item.disabled ?? false,
      }
    : item

class Popup implements MenuPresenter {
  ready = $state(false)

  #owner = getCurrentWebviewWindow()

  #seq = 0

  #request: ContextMenuRequest | null = null

  #items: MenuItem[] = []

  #stops: Promise<() => void>[] = []

  constructor() {
    this.#stops = [
      this.#owner.listen<PopupPick>("files-menu:pick", e =>
        this.#pick(e.payload),
      ),
      this.#owner.listen<number>("files-menu:closed", e => {
        if (e.payload === this.#seq) {
          closeContextMenu()
        }
      }),
      listen("files-menu:ready", () => {
        this.ready = true
      }),
    ]

    call<boolean>("menu_prepare")
      .then(ready => {
        this.ready ||= ready
      })
      .catch(() => undefined)
  }

  show(request: ContextMenuRequest, dense: boolean) {
    if (request !== this.#request) {
      this.#request = request
      this.#seq += 1
    }

    this.#items = [...request.items]

    const payload: PopupRequest = {
      seq: this.#seq,
      owner: this.#owner.label,
      x: request.x,
      y: request.y,
      dense,
      entries: this.#items.map(serialize),
    }

    emitTo(POPUP, "files-menu:open", payload).catch(() => undefined)
  }

  key(key: string) {
    emitTo(POPUP, "files-menu:key", key).catch(() => undefined)
  }

  hide() {
    if (this.#request) {
      this.#request = null
      emitTo(POPUP, "files-menu:hide", this.#seq).catch(() => undefined)
    }
  }

  stop() {
    this.hide()

    for (const stop of this.#stops) {
      stop.then(unlisten => unlisten())
    }
  }

  #pick({ seq, index }: PopupPick) {
    const item = this.#items[index]

    if (seq !== this.#seq || !item || !isAction(item) || item.disabled) {
      return
    }

    closeContextMenu()
    Promise.resolve(item.action()).catch(() => undefined)
  }
}

export const presentMenus = () => {
  const popup = new Popup()

  contextMenu.presenter = popup

  return () => {
    popup.stop()

    if (contextMenu.presenter === popup) {
      contextMenu.presenter = null
    }
  }
}
