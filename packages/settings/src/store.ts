import { emit, listen } from "@tauri-apps/api/event"
import { load } from "@tauri-apps/plugin-store"
import { isEqual } from "es-toolkit"
import type { DeviceSettings, PinPath, Pins, Profile } from "./model"
import { withDeviceDefaults, withProfileDefaults } from "./normalize"
import { commit, receive, syncedOf, toggle } from "./pins"

const FILE = "settings.json"
const DEVICE_KEY = "device"
const PROFILE_KEY = "profile"
const PINS_KEY = "pins"
const LOCK = "eris-settings"
export const DEVICE_EVENT = "settings-changed"
export const PROFILE_EVENT = "profile-changed"
const PINS_EVENT = "pins-changed"

// navigator.locks spans every window; the chain keeps order where locks are missing, such as tests
let writing: Promise<unknown> = Promise.resolve()

const exclusive = <T>(task: () => Promise<T>) =>
  typeof navigator !== "undefined" && "locks" in navigator
    ? navigator.locks.request(LOCK, task)
    : task()

const queued = <T>(task: () => Promise<T>) => {
  const next = writing.then(() => exclusive(task))

  writing = next.then(
    () => undefined,
    () => undefined,
  )

  return next
}

export const loadDevice = async (): Promise<DeviceSettings> => {
  const store = await load(FILE)
  const saved = await store.get<Partial<DeviceSettings>>(DEVICE_KEY)

  return withDeviceDefaults(saved)
}

const writeDevice = async (value: DeviceSettings) => {
  const store = await load(FILE)

  await store.set(DEVICE_KEY, value)
  await store.save()
  await emit(DEVICE_EVENT, value)
}

export const saveDevice = (value: DeviceSettings) =>
  queued(() => writeDevice(value))

export const updateDevice = (
  change: (device: DeviceSettings) => DeviceSettings,
) => queued(async () => writeDevice(change(await loadDevice())))

export const onDevice = (handler: (value: DeviceSettings) => void) =>
  listen<DeviceSettings>(DEVICE_EVENT, event => handler(event.payload))

export const loadPins = async (): Promise<Pins> => {
  const store = await load(FILE)

  return (await store.get<Pins>(PINS_KEY)) ?? {}
}

export const loadProfile = async (): Promise<Profile> => {
  const store = await load(FILE)

  return withProfileDefaults(await store.get<Partial<Profile>>(PROFILE_KEY))
}

export const loadSyncedProfile = async () =>
  syncedOf(await loadProfile(), await loadPins())

const writePins = async (pins: Pins, stored: Pins) => {
  if (isEqual(pins, stored)) {
    return
  }

  const store = await load(FILE)

  if (Object.keys(pins).length === 0) {
    await store.delete(PINS_KEY)
  } else {
    await store.set(PINS_KEY, pins)
  }

  await emit(PINS_EVENT, pins)
}

const writeProfile = async (profile: Profile, pins: Pins, stored: Pins) => {
  const store = await load(FILE)

  await writePins(pins, stored)
  await store.set(PROFILE_KEY, profile)
  await store.save()
  await emit(PROFILE_EVENT, profile)
}

// true when the synced view changed, the only change other devices must see
const saveLocal = async (value: Profile, local: Profile) => {
  const pins = await loadPins()
  const profile = withProfileDefaults(value)
  const next = commit(profile, pins, syncedOf(local, pins))

  await writeProfile(profile, next.pins, pins)

  return next.changed
}

export const saveProfile = (value: Profile) =>
  queued(async () => saveLocal(value, await loadProfile()))

export const updateProfile = (change: (profile: Profile) => Profile) =>
  queued(async () => {
    const local = await loadProfile()

    return saveLocal(change(local), local)
  })

export const saveSyncedProfile = (value: Profile) =>
  queued(async () => {
    const pins = await loadPins()
    const next = receive(withProfileDefaults(value), await loadProfile(), pins)

    await writeProfile(next.profile, next.pins, pins)
  })

// true when unpinning promoted this PC's value into the synced profile
export const togglePin = (path: PinPath) =>
  queued(async () => {
    const pins = await loadPins()
    const next = toggle(await loadProfile(), pins, path)

    await writePins(next.pins, pins)
    await (await load(FILE)).save()

    return next.changed
  })

export const onPins = (handler: (pins: Pins) => void) =>
  listen<Pins>(PINS_EVENT, event => handler(event.payload))

export const onProfile = (handler: (value: Profile) => void) =>
  listen<Profile>(PROFILE_EVENT, event => handler(event.payload))
