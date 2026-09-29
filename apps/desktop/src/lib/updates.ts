import {
  isPermissionGranted,
  sendNotification,
} from "@tauri-apps/plugin-notification"
import { check } from "@tauri-apps/plugin-updater"

let checked = false

export const announceUpdate = async (
  describe: (version: string) => { title: string; body: string },
) => {
  if (checked) {
    return
  }

  checked = true

  const update = await check().catch(() => null)

  if (update && (await isPermissionGranted())) {
    sendNotification(describe(update.version))
  }
}
