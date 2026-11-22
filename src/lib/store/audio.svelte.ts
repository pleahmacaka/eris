import type { Message } from "#lib/i18n/translate.js"
import {
  DEVICE_SWITCH_ERROR,
  errorCode,
  microphoneError,
} from "#lib/matrix/errors.js"
import {
  type AudioPrefs,
  type AudioProcessing,
  captureOptions,
  DEFAULT_AUDIO_PREFS,
  type DeviceOption,
  deviceOptions,
  labelsHidden,
  loadAudioPrefs,
  resolveDevice,
  saveAudioPrefs,
} from "#lib/media/devices.js"
import { openMeter } from "#lib/media/meter.js"
import { requestMicrophone } from "#lib/media/microphone.js"
import { callStore } from "#lib/store/call.svelte.js"
import { groupCallStore } from "#lib/store/groupCall.svelte.js"

class AudioStore {
  prefs = $state.raw<AudioPrefs>(DEFAULT_AUDIO_PREFS)
  inputs = $state.raw<DeviceOption[]>([])
  outputs = $state.raw<DeviceOption[]>([])
  outputSelectable = $state(false)
  needsAccess = $state(false)
  testing = $state(false)
  level = $state(0)
  error = $state<Message | null>(null)

  inputId = $derived(resolveDevice(this.prefs.inputId, this.inputs))
  outputId = $derived(resolveDevice(this.prefs.outputId, this.outputs))

  private stream: MediaStream | null = null
  private closeMeter: (() => void) | null = null

  start() {
    this.prefs = loadAudioPrefs(localStorage)
    this.outputSelectable = "setSinkId" in HTMLMediaElement.prototype
    void this.publish()
  }

  watchDevices() {
    const refresh = () => void this.refresh()

    refresh()
    navigator.mediaDevices.addEventListener("devicechange", refresh)

    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", refresh)
  }

  async requestAccess() {
    this.error = null

    try {
      await requestMicrophone()
      await this.refresh()
    } catch (error) {
      this.error = microphoneError(errorCode(error))
    }
  }

  selectInput(deviceId: string | null) {
    return this.update({ ...this.prefs, inputId: deviceId })
  }

  selectOutput(deviceId: string | null) {
    return this.update({ ...this.prefs, outputId: deviceId })
  }

  setProcessing(key: AudioProcessing, enabled: boolean) {
    return this.update({ ...this.prefs, [key]: enabled })
  }

  async startTest() {
    this.error = null

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: captureOptions(this.prefs),
      })

      this.stream = stream
      this.closeMeter = openMeter(stream, level => {
        this.level = level
      })
      this.testing = true
      await this.refresh()
    } catch (error) {
      this.error = microphoneError(errorCode(error))
    }
  }

  stopTest() {
    this.closeMeter?.()
    this.closeMeter = null

    for (const track of this.stream?.getTracks() ?? []) {
      track.stop()
    }

    this.stream = null
    this.testing = false
    this.level = 0
  }

  private async refresh() {
    const devices = await navigator.mediaDevices.enumerateDevices()

    this.needsAccess = labelsHidden(devices)
    this.inputs = deviceOptions(devices, "audioinput")
    this.outputs = deviceOptions(devices, "audiooutput")
  }

  private async update(prefs: AudioPrefs) {
    this.prefs = prefs
    this.error = null
    saveAudioPrefs(localStorage, prefs)

    try {
      await this.publish()
    } catch (error) {
      console.warn("audio device switch failed", error)
      this.error = DEVICE_SWITCH_ERROR
    }

    if (this.testing) {
      this.stopTest()
      await this.startTest()
    }
  }

  private publish() {
    return Promise.all([
      callStore.useAudio(this.prefs),
      groupCallStore.useAudio(this.prefs),
    ])
  }
}

export const audioStore = new AudioStore()
