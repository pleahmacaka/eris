const CHANNEL = "eris-studio"
const PREFIX = "eris-studio:"

export type BusMessage =
  | { kind: "event"; event: string; payload: unknown }
  | {
      kind: "ipc"
      label: string
      cmd: string
      args: unknown
      mocked: boolean
    }

export type LogEntry = {
  id: number
  at: number
  label: string
  name: string
  detail: string
  kind: "ipc" | "event" | "missing"
}

export const openBus = () => new BroadcastChannel(CHANNEL)

export const readStore = (path: string): Record<string, unknown> =>
  JSON.parse(localStorage.getItem(PREFIX + path) ?? "{}")

export const writeStore = (path: string, data: Record<string, unknown>) =>
  localStorage.setItem(PREFIX + path, JSON.stringify(data))

export const resetStores = () => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX))

  for (const key of keys) {
    localStorage.removeItem(key)
  }
}

let deliverLocal: ((event: string, payload: unknown) => void) | undefined

export const setLocalDelivery = (
  deliver: (event: string, payload: unknown) => void,
) => {
  deliverLocal = deliver
}

const bus = typeof BroadcastChannel === "undefined" ? undefined : openBus()

export const publish = (event: string, payload: unknown) => {
  bus?.postMessage({ kind: "event", event, payload } satisfies BusMessage)
  deliverLocal?.(event, payload)
}
