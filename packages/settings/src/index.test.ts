import { beforeEach, expect, mock, test } from "bun:test"

const data = new Map<string, unknown>()
const emitted: unknown[] = []
const operations: string[] = []
let saveHook: (() => Promise<void>) | undefined
let emitError: Error | undefined

mock.module("@tauri-apps/plugin-store", () => ({
  load: async (file: string) => {
    expect(file).toBe("settings.json")

    return {
      get: async (key: string) => {
        operations.push(`get:${key}`)

        return data.get(key)
      },
      set: async (key: string, value: unknown) => {
        operations.push(`set:${key}`)
        data.set(key, value)
      },
      save: async () => {
        operations.push("save")
        await saveHook?.()
      },
    }
  },
}))

mock.module("@tauri-apps/api/event", () => ({
  emit: async (name: string, value: unknown) => {
    operations.push(`emit:${name}`)
    if (emitError) {
      throw emitError
    }
    emitted.push(value)
  },
  listen: async () => () => undefined,
}))

mock.module("@tauri-apps/api/core", () => ({ invoke: async () => null }))

const {
  DEVICE_EVENT,
  PROFILE_EVENT,
  defaultAppearance,
  defaultDevice,
  defaultProfile,
  loadDevice,
  loadProfile,
  saveDevice,
  saveProfile,
  updateDevice,
  updateProfile,
} = await import("./index")

beforeEach(() => {
  data.clear()
  emitted.length = 0
  operations.length = 0
  saveHook = undefined
  emitError = undefined
})

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

test("device saves and both updates share one ordered write queue", async () => {
  let release = () => {}
  let started = () => {}
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const firstSave = new Promise<void>(resolve => {
    started = resolve
  })
  saveHook = async () => {
    saveHook = undefined
    started()
    await gate
  }

  const saved = { ...defaultDevice, dockHeight: 60 }
  const saving = saveDevice(saved)
  const updatingProfile = updateProfile(profile => ({
    ...profile,
    presetId: "custom",
    todo: { ...profile.todo, showCompleted: true },
  }))
  const updatingDevice = updateDevice(device => ({
    ...device,
    dockHeight: device.dockHeight + 1,
  }))

  await firstSave
  expect(operations).toEqual(["set:device", "save"])
  release()
  expect(await saving).toBeUndefined()
  const profile = await updatingProfile
  expect(await updatingDevice).toBeUndefined()
  expect(profile.todo.showCompleted).toBe(true)
  expect(data.get("device")).toEqual({ ...saved, dockHeight: 61 })
  expect(operations).toEqual([
    "set:device",
    "save",
    `emit:${DEVICE_EVENT}`,
    "get:profile",
    "set:profile",
    "save",
    `emit:${PROFILE_EVENT}`,
    "get:device",
    "set:device",
    "save",
    `emit:${DEVICE_EVENT}`,
  ])
  expect(emitted[0]).toBe(saved)
  expect(emitted[1]).toEqual(profile)
})

test("a failed queued write rejects its caller without poisoning later writes", async () => {
  emitError = new Error("emit failed")
  const saved = { ...defaultDevice, dockHeight: 60 }

  await expect(saveDevice(saved)).rejects.toThrow("emit failed")
  emitError = undefined
  await updateDevice(device => ({
    ...device,
    dockHeight: device.dockHeight + 1,
  }))

  expect(data.get("device")).toEqual({ ...saved, dockHeight: 61 })
  expect(emitted).toEqual([{ ...saved, dockHeight: 61 }])
})

test("direct profile saves remain outside the device write queue", async () => {
  let release = () => {}
  let started = () => {}
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const firstSave = new Promise<void>(resolve => {
    started = resolve
  })
  saveHook = async () => {
    saveHook = undefined
    started()
    await gate
  }

  const saving = saveDevice(defaultDevice)
  await firstSave
  await saveProfile(defaultProfile)
  expect(operations).toEqual([
    "set:device",
    "save",
    "set:profile",
    "save",
    `emit:${PROFILE_EVENT}`,
  ])
  release()
  await saving
  expect(operations.at(-1)).toBe(`emit:${DEVICE_EVENT}`)
})
