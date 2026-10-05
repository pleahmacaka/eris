import { machineName } from "./platform/host"
import { type DeviceSettings, loadDevice, saveDevice } from "./settings"

const LOCK = "arixlab-note-device"

let inflight: Promise<DeviceSettings> | undefined

const fill = async () => {
  const device = await loadDevice()
  const deviceId = device.deviceId || crypto.randomUUID()
  const deviceName = device.deviceName || (await machineName().catch(() => ""))

  if (deviceId === device.deviceId && deviceName === device.deviceName) {
    return device
  }

  await saveDevice({ ...device, deviceId, deviceName })

  return loadDevice()
}

const claim = (): Promise<DeviceSettings> =>
  globalThis.navigator?.locks?.request(LOCK, fill) ?? fill()

export const ensureDevice = () => {
  inflight ??= claim().finally(() => {
    inflight = undefined
  })

  return inflight
}
