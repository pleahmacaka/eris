import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

export const setShareWatch = (enabled: boolean) =>
  invoke<void>("set_share_watch", { enabled })

export const watchScreenShare = (run: (sharing: boolean) => void) => {
  invoke<boolean>("screen_sharing")
    .then(run)
    .catch(() => undefined)

  return listen<boolean>("screen-share", e => run(e.payload))
}
