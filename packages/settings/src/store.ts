import { emit, listen } from "@tauri-apps/api/event"
import { load } from "@tauri-apps/plugin-store"
import type { DeviceSettings, Profile } from "./model"
import { withDeviceDefaults, withProfileDefaults } from "./normalize"

const FILE = "settings.json"
const DEVICE_KEY = "device"
const PROFILE_KEY = "profile"
export const DEVICE_EVENT = "settings-changed"
export const PROFILE_EVENT = "profile-changed"

export const loadDevice = async (): Promise<DeviceSettings> => {
  const store = await load(FILE)
  const saved = await store.get<Partial<DeviceSettings>>(DEVICE_KEY)

  return withDeviceDefaults(saved)
}

// writes serialize so a read-modify-write cannot interleave with another save
// This one queue is shared by saveDevice, updateDevice and updateProfile.
// saveProfile remains unqueued, including when called from updateProfile.
let writing: Promise<unknown> = Promise.resolve()

const writeDevice = async (value: DeviceSettings) => {
  const store = await load(FILE)

  await store.set(DEVICE_KEY, value)
  await store.save()
  await emit(DEVICE_EVENT, value)
}

export const saveDevice = (value: DeviceSettings) => {
  const next = writing.then(() => writeDevice(value))

  writing = next.then(
    () => undefined,
    () => undefined,
  )

  return next
}

export const updateDevice = (
  change: (device: DeviceSettings) => DeviceSettings,
) => {
  const next = writing.then(async () => {
    const device = await loadDevice()

    await writeDevice(change(device))
  })

  writing = next.then(
    () => undefined,
    () => undefined,
  )

  return next
}

export const onDevice = (handler: (value: DeviceSettings) => void) =>
  listen<DeviceSettings>(DEVICE_EVENT, event => handler(event.payload))

export const loadProfile = async (): Promise<Profile> => {
  const store = await load(FILE)

  return withProfileDefaults(await store.get<Partial<Profile>>(PROFILE_KEY))
}

export const saveProfile = async (value: Profile) => {
  const store = await load(FILE)
  const profile = withProfileDefaults(value)

  await store.set(PROFILE_KEY, profile)
  await store.save()
  await emit(PROFILE_EVENT, profile)
}

export const updateProfile = (change: (profile: Profile) => Profile) => {
  const next = writing.then(async () => {
    const profile = change(await loadProfile())

    await saveProfile(profile)

    return profile
  })

  writing = next.then(
    () => undefined,
    () => undefined,
  )

  return next
}

export const onProfile = (handler: (value: Profile) => void) =>
  listen<Profile>(PROFILE_EVENT, event => handler(event.payload))
