import type { ClientInit } from "@sveltejs/kit"

export const init: ClientInit = async () => {
  if (window.__TAURI_INTERNALS__ && window === window.top) {
    return
  }

  const { installMocks } = await import("$lib/studio")

  installMocks(location.pathname)
}
