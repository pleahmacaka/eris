import { expect, mock, test } from "bun:test"

const data = new Map<string, unknown>()
let writes = 0

mock.module("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async (key: string) => data.get(key),
    set: async (key: string, value: unknown) => {
      writes += 1
      data.set(key, value)
    },
    save: async () => undefined,
  }),
}))

mock.module("@tauri-apps/api/event", () => ({
  emit: async () => undefined,
  listen: async () => () => undefined,
}))

mock.module("@tauri-apps/api/core", () => ({ invoke: async () => "PC" }))

const { ensureDevice } = await import("./device")

test("concurrent calls claim one identity and persist it once", async () => {
  const [a, b] = await Promise.all([ensureDevice(), ensureDevice()])
  const c = await ensureDevice()

  expect(a.deviceId).not.toBe("")
  expect(b.deviceId).toBe(a.deviceId)
  expect(c.deviceId).toBe(a.deviceId)
  expect(c.deviceName).toBe("PC")
  expect(writes).toBe(1)
})
