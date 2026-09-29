import { publish, subscribe } from "./platform/events"
import { type KeyValueStore, openStore } from "./platform/storage"
import { type SyncedCollection, syncedCollections } from "./sync/protocol"

export type ThemeMode = "system" | "dark" | "light"

export type TodoSort = "manual" | "due" | "priority"

export type NoteSort = "updated" | "created" | "title"

export type Appearance = {
  mode: ThemeMode
  fontScale: number
  showCompleted: boolean
  todoSort: TodoSort
  noteSort: NoteSort
  weekStartsMonday: boolean
}

export type SyncSettings = {
  intervalMinutes: number
  collections: Record<SyncedCollection, boolean>
}

export type VaultSettings = {
  path: string | null
  templates: string
}

export type AdvancedSettings = {
  scripts: boolean
}

export type DeviceSettings = {
  deviceId: string
  deviceName: string
  appearance: Appearance
  sync: SyncSettings
  vault: VaultSettings
  advanced: AdvancedSettings
}

export const defaultAppearance: Appearance = {
  mode: "system",
  fontScale: 1,
  showCompleted: false,
  todoSort: "due",
  noteSort: "updated",
  weekStartsMonday: true,
}

export const defaultSync: SyncSettings = {
  intervalMinutes: 5,
  collections: { files: true, todos: true, events: true },
}

export const defaultVault: VaultSettings = {
  path: null,
  templates: "templates",
}

export const defaultAdvanced: AdvancedSettings = {
  scripts: false,
}

export const defaultDevice: DeviceSettings = {
  deviceId: "",
  deviceName: "",
  appearance: defaultAppearance,
  sync: defaultSync,
  vault: defaultVault,
  advanced: defaultAdvanced,
}

const FILE = "settings.json"
const KEY = "device"
const SETTINGS_EVENT = "settings-changed"

let handle: Promise<KeyValueStore> | undefined

const store = () => {
  handle ??= openStore(FILE)

  return handle
}

const merge = (saved: Partial<DeviceSettings> | undefined): DeviceSettings => ({
  ...defaultDevice,
  ...saved,
  appearance: { ...defaultAppearance, ...saved?.appearance },
  sync: {
    intervalMinutes:
      saved?.sync?.intervalMinutes ?? defaultSync.intervalMinutes,
    collections: Object.fromEntries(
      syncedCollections.map(name => [
        name,
        saved?.sync?.collections?.[name] ?? defaultSync.collections[name],
      ]),
    ) as SyncSettings["collections"],
  },
  vault: { ...defaultVault, ...saved?.vault },
  advanced: { ...defaultAdvanced, ...saved?.advanced },
})

export const loadDevice = async () =>
  merge(await (await store()).get<Partial<DeviceSettings>>(KEY))

export const saveDevice = async (device: DeviceSettings) => {
  const db = await store()

  await db.set(KEY, device)
  await db.save()
  await publish(SETTINGS_EVENT, device)

  return device
}

export const patchDevice = async (patch: Partial<DeviceSettings>) =>
  saveDevice({ ...(await loadDevice()), ...patch })

export const patchSync = async (patch: Partial<SyncSettings>) => {
  const device = await loadDevice()

  return saveDevice({ ...device, sync: { ...device.sync, ...patch } })
}

export const patchAppearance = async (patch: Partial<Appearance>) => {
  const device = await loadDevice()

  return saveDevice({
    ...device,
    appearance: { ...device.appearance, ...patch },
  })
}

export const patchVault = async (patch: Partial<VaultSettings>) => {
  const device = await loadDevice()

  return saveDevice({ ...device, vault: { ...device.vault, ...patch } })
}

export const patchAdvanced = async (patch: Partial<AdvancedSettings>) => {
  const device = await loadDevice()

  return saveDevice({ ...device, advanced: { ...device.advanced, ...patch } })
}

export const enabledCollections = (sync: SyncSettings) =>
  syncedCollections.filter(name => sync.collections[name])

export const onDevice = (handler: (device: DeviceSettings) => void) =>
  subscribe<Partial<DeviceSettings>>(SETTINGS_EVENT, saved =>
    handler(merge(saved)),
  )
