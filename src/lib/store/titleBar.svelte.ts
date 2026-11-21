import { getCurrentWindow } from "@tauri-apps/api/window"
import { isDesktopApp } from "#lib/shell/platform.js"
import {
  loadTitleBarSetting,
  saveTitleBarSetting,
} from "#lib/shell/titleBar.js"

class TitleBarStore {
  supported = $state(false)
  custom = $state(true)

  start() {
    this.supported = isDesktopApp()
    this.custom = loadTitleBarSetting(localStorage)

    if (this.supported) {
      void getCurrentWindow().setDecorations(!this.custom)
    }
  }

  async setCustom(custom: boolean) {
    this.custom = custom
    saveTitleBarSetting(localStorage, custom)
    await getCurrentWindow().setDecorations(!custom)
  }
}

export const titleBarStore = new TitleBarStore()
