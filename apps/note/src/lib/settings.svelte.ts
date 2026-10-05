import {
  type DeviceSettings,
  defaultDevice,
  loadDevice,
  onDevice,
} from "./settings"

export const device = $state<{ value: DeviceSettings; ready: boolean }>({
  value: defaultDevice,
  ready: false,
})

export const watchDevice = () => {
  loadDevice().then(loaded => {
    device.value = loaded
    device.ready = true
  })

  const unlisten = onDevice(next => {
    device.value = next
  })

  return () => {
    unlisten.then(stop => stop())
  }
}
