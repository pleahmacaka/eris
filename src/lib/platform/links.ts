import { isTauri } from "./runtime"

export const openExternal = async (url: string) => {
  if (!isTauri() || !/^https?:\/\//i.test(url)) {
    return
  }

  const { openUrl } = await import("@tauri-apps/plugin-opener")

  await openUrl(url)
}

export const onAppLinks = async (handler: (url: string) => void) => {
  const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link")

  for (const url of (await getCurrent()) ?? []) {
    handler(url)
  }

  return onOpenUrl(urls => {
    for (const url of urls) {
      handler(url)
    }
  })
}
