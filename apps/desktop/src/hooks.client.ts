import type { ClientInit } from "@sveltejs/kit/hooks"
import { resolve } from "$app/paths"

export const init: ClientInit = async () => {
  if (window.__TAURI_INTERNALS__ && window === window.top) {
    return
  }

  const { installMocks } = await import("#lib/studio/index.js")

  installMocks(location.pathname.slice(resolve("").length) || "/")
}
