import type { DeviceSettings } from "@eris/settings"
import { readSnapshot } from "@eris/sync/merge"
import type { Snapshot } from "@eris/sync/protocol"
import { applyRemote, localRecords, onDataChange } from "$lib/data"
import { noteBridgePublish, noteBridgeRead } from "$lib/native"
import { ensureDevice } from "../device"
import { conformed } from "./engine"

const POLL = 15_000
const DEBOUNCE = 1_000

const TOKENS = [
  "base-100",
  "base-200",
  "base-300",
  "base-content",
  "primary",
  "primary-content",
  "secondary",
  "secondary-content",
  "accent",
  "accent-content",
  "neutral",
  "neutral-content",
]

const linked = (device: DeviceSettings) =>
  device.note.enabled && device.note.calendar

const styleOf = (device: DeviceSettings) => {
  const follow = device.note.enabled && device.note.style

  if (!follow) {
    return { version: 1, follow }
  }

  const probe = document.createElement("span")

  document.body.append(probe)

  const colors = Object.fromEntries(
    TOKENS.map(token => {
      probe.style.color = `var(--color-${token})`

      return [token, getComputedStyle(probe).color]
    }),
  )

  probe.remove()

  return {
    version: 1,
    follow,
    mode: document.documentElement.dataset.mode ?? "dark",
    colors,
  }
}

export const startNoteLink = () => {
  let published = ""
  let styled = ""
  let received = ""
  let timer: ReturnType<typeof setTimeout> | undefined

  const publish = async () => {
    const device = await ensureDevice()

    if (!linked(device)) {
      return
    }

    const records = await localRecords(["events"])
    const text = JSON.stringify({
      deviceId: device.deviceId,
      app: "eris",
      records,
    } satisfies Snapshot)

    if (text !== published) {
      published = text
      await noteBridgePublish("events.json", text)
    }
  }

  const publishStyle = async () => {
    const text = JSON.stringify(styleOf(await ensureDevice()))

    if (text !== styled) {
      styled = text
      await noteBridgePublish("style.json", text)
    }
  }

  const pull = async () => {
    const device = await ensureDevice()

    if (!linked(device)) {
      return
    }

    const text = await noteBridgeRead()

    if (!text || text === received) {
      return
    }

    received = text

    const records = readSnapshot(text)
      .map(conformed)
      .filter(record => record !== null)

    if (records.length > 0) {
      await applyRemote(records)
    }
  }

  const tick = () => {
    pull()
      .then(publish)
      .catch(() => undefined)

    publishStyle().catch(() => undefined)
  }

  tick()

  const poll = setInterval(tick, POLL)
  const stop = onDataChange(change => {
    if (change.collection === "events" && !change.remote) {
      clearTimeout(timer)
      timer = setTimeout(() => publish().catch(() => undefined), DEBOUNCE)
    }
  })

  return () => {
    clearInterval(poll)
    clearTimeout(timer)
    stop.then(fn => fn())
  }
}
