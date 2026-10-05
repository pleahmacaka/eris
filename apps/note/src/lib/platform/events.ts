import { isTauri } from "./runtime"

const CHANNEL = "arixlab-note"

let channel: BroadcastChannel | undefined

const bus = () => {
  channel ??= new BroadcastChannel(CHANNEL)

  return channel
}

const local = new EventTarget()

export const publish = async (name: string, payload: unknown) => {
  if (isTauri()) {
    const { emit } = await import("@tauri-apps/api/event")

    await emit(name, payload)

    return
  }

  bus().postMessage({ name, payload })
  local.dispatchEvent(new CustomEvent(name, { detail: payload }))
}

export const subscribe = async <T>(
  name: string,
  handler: (payload: T) => void,
) => {
  if (isTauri()) {
    const { listen } = await import("@tauri-apps/api/event")

    return listen<T>(name, e => handler(e.payload))
  }

  const onLocal = (e: Event) => handler((e as CustomEvent<T>).detail)
  const onRemote = (e: MessageEvent) => {
    if (e.data?.name === name) {
      handler(e.data.payload as T)
    }
  }

  local.addEventListener(name, onLocal)
  bus().addEventListener("message", onRemote)

  return () => {
    local.removeEventListener(name, onLocal)
    bus().removeEventListener("message", onRemote)
  }
}
