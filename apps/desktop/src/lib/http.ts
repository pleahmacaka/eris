import { fetch as tauriFetch } from "@tauri-apps/plugin-http"
import axios, { type AxiosAdapter, AxiosError, AxiosHeaders } from "axios"

const bodyOf = (data: unknown) => {
  if (data === undefined || data === null) {
    return undefined
  }

  return typeof data === "string" ? data : JSON.stringify(data)
}

const parse = (text: string, type: string | null) => {
  if (text === "") {
    return undefined
  }

  if (type?.includes("application/json")) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  return text
}

// the webview enforces CORS, so requests go through the Tauri http plugin instead
const adapter: AxiosAdapter = async config => {
  const url = new URL(
    config.url ?? "",
    config.baseURL || "http://localhost",
  ).toString()

  const headers = new AxiosHeaders(config.headers).toJSON() as Record<
    string,
    string
  >

  const controller = new AbortController()
  const caller = config.signal as AbortSignal | undefined

  caller?.addEventListener("abort", () => controller.abort(), { once: true })

  // axios enforces timeout only in its own adapters, so the custom adapter must abort the fetch itself
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    if (config.timeout) {
      timer = setTimeout(() => {
        reject(
          new AxiosError(
            `timeout of ${config.timeout}ms exceeded`,
            "ECONNABORTED",
            config,
          ),
        )
        controller.abort()
      }, config.timeout)
    }
  })

  let response: Response
  let text: string

  try {
    response = await Promise.race([
      tauriFetch(url, {
        method: (config.method ?? "get").toUpperCase(),
        headers,
        body: bodyOf(config.data),
        signal: controller.signal,
      }),
      deadline,
    ])
    text = await Promise.race([response.text(), deadline])
  } finally {
    clearTimeout(timer)
  }

  const result = {
    data: parse(text, response.headers.get("content-type")),
    status: response.status,
    statusText: response.statusText,
    headers: new AxiosHeaders(Object.fromEntries(response.headers.entries())),
    config,
    request: null,
  }

  if (response.status >= 400) {
    throw new AxiosError(
      `Request failed with status code ${response.status}`,
      String(response.status),
      config,
      null,
      result,
    )
  }

  return result
}

export const http = axios.create({ adapter, timeout: 20_000 })
