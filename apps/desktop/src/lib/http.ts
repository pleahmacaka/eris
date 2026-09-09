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

  const response = await tauriFetch(url, {
    method: (config.method ?? "get").toUpperCase(),
    headers,
    body: bodyOf(config.data),
    signal: config.signal as AbortSignal | undefined,
  })

  const text = await response.text()

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
