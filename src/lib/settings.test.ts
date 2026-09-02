import { expect, mock, test } from "bun:test"

const data = new Map<string, unknown>()
const emitted: unknown[] = []

mock.module("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async (key: string) => data.get(key),
    set: async (key: string, value: unknown) => data.set(key, value),
    save: async () => undefined,
  }),
}))

mock.module("@tauri-apps/api/event", () => ({
  emit: async (_name: string, value: unknown) => emitted.push(value),
  listen: async () => () => undefined,
}))

mock.module("@tauri-apps/api/core", () => ({ invoke: async () => null }))

const {
  defaultAppearance,
  defaultDevice,
  loadDevice,
  loadProfile,
  saveProfile,
} = await import("./settings")

test("a profile from an older build is completed before it is stored", async () => {
  const partial = {
    presetId: "aurora",
    appearance: { mode: "dark", background: "aura" },
  }

  await saveProfile(partial as unknown as Parameters<typeof saveProfile>[0])

  const [emitted0] = emitted as [{ appearance: { surfaceOpacity: number } }]

  expect(emitted0.appearance.surfaceOpacity).toBe(
    defaultAppearance.surfaceOpacity,
  )
  expect((await loadProfile()).appearance.dockOpacity).toBe(
    defaultAppearance.dockOpacity,
  )
})

test("a device from an older build gains the new dock and sync defaults", async () => {
  data.set("device", {
    dockHeight: 40,
    sync: { enabled: true, collections: { todos: false } },
  })

  const device = await loadDevice()

  expect(device.dockHeight).toBe(40)
  expect(device.showMedia).toBe(defaultDevice.showMedia)
  expect(device.showMeters).toBe(defaultDevice.showMeters)
  expect(device.showNetwork).toBe(defaultDevice.showNetwork)
  expect(device.sync.collections.todos).toBe(false)
  expect(device.sync.collections.notes).toBe(true)
})
