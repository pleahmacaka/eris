import { listen } from "@tauri-apps/api/event"
import * as native from "#lib/native/index.js"

// Each Tray owns its polling and subscription; effects are disposed with its
// component. Opening the panel and mute actions update the same local snapshot.
export class TrayStatus {
  info = $state<native.SystemInfo>({ battery: null, volume: null })
  unseen = $state(0)

  constructor(notificationsEnabled: () => boolean) {
    $effect(() => {
      this.refresh()
      const timer = setInterval(this.refresh, 5_000)
      return () => clearInterval(timer)
    })
    $effect(() => {
      if (!notificationsEnabled()) {
        return
      }
      this.refreshUnseen()
      const timer = setInterval(this.refreshUnseen, 30_000)
      const stop = listen("notices-changed", this.refreshUnseen)
      return () => {
        clearInterval(timer)
        stop.then(off => off()).catch(() => undefined)
      }
    })
  }

  private refresh = async () => {
    this.info = await native.systemInfo().catch(() => this.info)
  }

  private refreshUnseen = async () => {
    this.unseen = await native.noticesUnseen().catch(() => this.unseen)
  }

  openNotices(box: DOMRect) {
    this.unseen = 0
    native
      .noticesOpenPanel([box.left, box.top, box.right, box.bottom])
      .catch(() => undefined)
  }

  toggleMute = () => {
    if (this.info.volume) {
      this.info.volume = {
        level: this.info.volume.level,
        muted: !this.info.volume.muted,
      }
    }
    native.toggleMute().catch(() => undefined)
  }
}
