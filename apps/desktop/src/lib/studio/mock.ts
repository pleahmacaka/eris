import type { InvokeArgs } from "@tauri-apps/api/core"
import { mockConvertFileSrc, mockIPC, mockWindows } from "@tauri-apps/api/mocks"
import pkg from "../../../package.json"
import {
  type BusMessage,
  openBus,
  readStore,
  setLocalDelivery,
  writeStore,
} from "./bus"
import { fixtures, silent } from "./fixtures"
import { labelFor, surfaces } from "./surfaces"

type Args = Record<string, unknown>

type Handler = (a: Args) => unknown

type Store = Record<string, unknown>

const INTENTS = "intents"

const SETTINGS = "settings.json"

const QUIET = [
  "plugin:app|",
  "plugin:autostart|",
  "plugin:clipboard-manager|",
  "plugin:dialog|",
  "plugin:global-shortcut|",
  "plugin:notification|",
  "plugin:process|",
  "plugin:resources|",
  "plugin:updater|",
  "plugin:webview|",
  "plugin:window|",
]

const screen = { width: 1920, height: 1080 }

const monitor = {
  name: "Studio display",
  scaleFactor: 1,
  position: { x: 0, y: 0 },
  size: screen,
  workArea: { position: { x: 0, y: 0 }, size: screen },
}

const record = (payload?: InvokeArgs): Args =>
  payload === undefined ||
  Array.isArray(payload) ||
  payload instanceof ArrayBuffer ||
  payload instanceof Uint8Array
    ? {}
    : payload

const cloneable = (args: Args) => {
  try {
    return JSON.parse(JSON.stringify(args))
  } catch {
    return "[unserializable]"
  }
}

let installed = false

export const mocked = () => installed

const seedAppearance = () => {
  const seeded = new URLSearchParams(location.search).get("appearance")

  if (!seeded) {
    return
  }

  try {
    const settings = readStore(SETTINGS)
    const profile = (settings.profile ?? {}) as Store

    writeStore(SETTINGS, {
      ...settings,
      profile: {
        ...profile,
        presetId: "community",
        appearance: JSON.parse(seeded),
      },
    })
  } catch {
    return
  }
}

export const installMocks = (path: string) => {
  installed = true

  seedAppearance()

  const label = labelFor(path)
  const bus = openBus()
  const listeners = new Map<string, Set<number>>()
  const visible = new Set(["taskbar", label])
  const stores = new Map<string, number>()

  const deliver = (event: string, payload: unknown) => {
    if (event === "window-shown") {
      visible.add(String(payload))
    }

    if (event === "window-hidden") {
      visible.delete(String(payload))
    }

    for (const id of listeners.get(event) ?? []) {
      window.__TAURI_INTERNALS__?.runCallback(id, { event, id, payload })
    }
  }

  const emit = (event: string, payload: unknown) => {
    deliver(event, payload)
    bus.postMessage({ kind: "event", event, payload } satisfies BusMessage)
  }

  const show = (target: unknown) => emit("window-shown", String(target))

  const hide = (target: unknown) => {
    emit("window-hiding", String(target))
    emit("window-hidden", String(target))
  }

  const own = (a: Args) => a.label ?? label

  const pathOf = (a: Args) =>
    [...stores].find(([, rid]) => rid === a.rid)?.[0] ?? ""

  const read = (a: Args) => readStore(pathOf(a))

  const mutate = (a: Args, change: (data: Store) => unknown) => {
    const data = read(a)
    const result = change(data)

    writeStore(pathOf(a), data)

    return result
  }

  const load = (a: Args) => {
    const file = String(a.path)
    const rid = stores.get(file) ?? stores.size + 1

    stores.set(file, rid)

    return rid
  }

  const handlers: Record<string, Handler> = {
    "plugin:event|listen": a => {
      const event = String(a.event)
      const id = Number(a.handler)

      listeners.set(event, (listeners.get(event) ?? new Set()).add(id))

      return id
    },
    "plugin:event|unlisten": a =>
      listeners.get(String(a.event))?.delete(Number(a.eventId)),
    "plugin:event|emit": a => emit(String(a.event), a.payload),
    "plugin:event|emit_to": a => emit(String(a.event), a.payload),

    "plugin:store|load": load,
    "plugin:store|get_store": a => stores.get(String(a.path)) ?? null,
    "plugin:store|get": a => {
      const data = read(a)
      const key = String(a.key)

      return [data[key] ?? null, key in data]
    },
    "plugin:store|set": a =>
      mutate(a, data => {
        data[String(a.key)] = a.value
      }),
    "plugin:store|has": a => String(a.key) in read(a),
    "plugin:store|delete": a => mutate(a, data => delete data[String(a.key)]),
    "plugin:store|clear": a => writeStore(pathOf(a), {}),
    "plugin:store|reset": a => writeStore(pathOf(a), {}),
    "plugin:store|keys": a => Object.keys(read(a)),
    "plugin:store|values": a => Object.values(read(a)),
    "plugin:store|entries": a => Object.entries(read(a)),
    "plugin:store|length": a => Object.keys(read(a)).length,
    "plugin:store|save": () => null,
    "plugin:store|reload": () => null,

    "plugin:app|version": () => pkg.version,
    "plugin:app|name": () => "eris",
    "plugin:app|identifier": () => "com.arixlab.eris.windows",
    "plugin:autostart|is_enabled": () => false,
    "plugin:notification|is_permission_granted": () => true,
    "plugin:global-shortcut|is_registered": () => false,
    "plugin:clipboard-manager|read_text": () => "",
    "plugin:http|fetch": () => {
      throw new Error("Studio has no network access")
    },

    "plugin:window|get_all_windows": () => surfaces.map(s => s.label),
    "plugin:window|is_visible": a => visible.has(String(own(a))),
    "plugin:window|is_focused": () => document.hasFocus(),
    "plugin:window|scale_factor": () => devicePixelRatio,
    "plugin:window|inner_size": () => ({
      width: innerWidth * devicePixelRatio,
      height: innerHeight * devicePixelRatio,
    }),
    "plugin:window|outer_size": () => ({
      width: innerWidth * devicePixelRatio,
      height: innerHeight * devicePixelRatio,
    }),
    "plugin:window|inner_position": () => ({ x: 0, y: 0 }),
    "plugin:window|outer_position": () => ({ x: 0, y: 0 }),
    "plugin:window|current_monitor": () => monitor,
    "plugin:window|primary_monitor": () => monitor,
    "plugin:window|monitor_from_point": () => monitor,
    "plugin:window|available_monitors": () => [monitor],
    "plugin:window|theme": () => "dark",
    "plugin:window|title": a => String(own(a)),
    "plugin:window|show": a => show(own(a)),
    "plugin:window|hide": a => hide(own(a)),
    "plugin:window|close": a => hide(own(a)),

    show_window: a => show(a.label),
    hide_window: a => hide(a.label),
    toggle_window: a =>
      visible.has(String(a.label)) ? hide(a.label) : show(a.label),
    notices_open_panel: () => show("notices"),
    notices_activate: () => hide("notices"),
    open_with_intent: a => {
      writeStore(INTENTS, {
        ...readStore(INTENTS),
        [String(a.label)]: a.intent,
      })
      show(a.label)
    },
    take_intent: a => {
      const pending = readStore(INTENTS)
      const intent = pending[String(a.label)] ?? null

      delete pending[String(a.label)]
      writeStore(INTENTS, pending)

      return intent
    },
  }

  mockWindows(label)
  mockConvertFileSrc("windows")

  mockIPC((cmd, payload) => {
    const args = record(payload)
    const handler = handlers[cmd] ?? fixtures[cmd]
    const mocked =
      handler !== undefined ||
      silent.has(cmd) ||
      QUIET.some(prefix => cmd.startsWith(prefix))

    if (!cmd.startsWith("plugin:event|")) {
      bus.postMessage({
        kind: "ipc",
        label,
        cmd,
        args: cloneable(args),
        mocked,
      } satisfies BusMessage)
    }

    if (!mocked) {
      console.warn(`[studio] no mock for ${cmd}`, args)
    }

    return handler?.(args) ?? null
  })

  bus.onmessage = (e: MessageEvent<BusMessage>) => {
    if (e.data.kind === "event") {
      deliver(e.data.event, e.data.payload)
    }
  }

  setLocalDelivery(deliver)
}
