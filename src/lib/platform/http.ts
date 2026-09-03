import { isTauri } from "./runtime"

export const httpFetch = async (
  url: string,
  init: RequestInit,
): Promise<Response> => {
  if (!isTauri()) {
    return fetch(url, init)
  }

  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http")

  return tauriFetch(url, init)
}
